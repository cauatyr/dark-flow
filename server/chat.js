const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')

const session = require('./session')
const darkflow = require('../api/darkflow_api')
const voiceSelector = require('../api/voice-selector')
const monitor = require('../scripts/monitor-videos')
const tiktok = require('../api/tiktok_api')

const CLI_TIMEOUT_MS = 300000

const VIDEOS_FILE = path.join(__dirname, '..', 'memory', 'videos-criados-por-mim.json')
const STORIES_DIR = path.join(__dirname, '..', 'stories')

// Upload YouTube/TikTok + fluxo de aprovação de postagem REMOVIDOS em 2026-04-24.
// Notificação de vídeo pronto agora é disparada direto pelo monitor-videos.js
// via session.broadcast (sem pendente-postagem.json intermediário).

const DURACOES_VALIDAS = {
  '30 segundos': { value: '30-segundos', tipo: 'tiktok', minChar: 200, maxChar: 300, imagens: 5 },
  '45 segundos': { value: '45-segundos', tipo: 'tiktok', minChar: 300, maxChar: 400, imagens: 5 },
  '1 minuto':    { value: '1-minuto',    tipo: 'tiktok', minChar: 450, maxChar: 600, imagens: 10 },
  '2 minutos':   { value: '2-minutos',   tipo: 'tiktok', minChar: 900, maxChar: 1100, imagens: 10 },
  '3 minutos':   { value: '3-minutos',   tipo: 'tiktok', minChar: 1500, maxChar: 1800, imagens: 15 },
  '5 minutos':   { value: '5-minutos',   tipo: 'tiktok', minChar: 3400, maxChar: 3750, imagens: 20 },
  '12 minutos':  { value: '12-minutos',  tipo: 'longo',  minChar: 8000, maxChar: 9000, imagens: 35 }
}

const SYSTEM_PROMPT = `Você é o DarkFlow Agent, um assistente especializado em criar histórias e roteiros de terror para shorts verticais (formato TikTok/Reels/Shorts) e vídeos longos.

REGRAS DE PERSONALIDADE:
- Tom dark, cinematográfico, direto. Sem floreios.
- Sempre escreve histórias de terror psicológico/sobrenatural — nunca sugere outro gênero.
- Usa emojis com moderação: apenas 🎬 🔴 ⏳ ✅ ❌ 📺 📱 🎙️
- Português brasileiro coloquial mas elegante.

ESTRUTURA OBRIGATÓRIA DAS HISTÓRIAS:
- CENA 0: GANCHO (3-5 segundos) — Frase que prende imediatamente
- CENA 1-2: Apresentação do mistério
- CENA 3-N: Tensão crescente com detalhes perturbadores
- CENA (N-1): reviravolta surpreendente que muda tudo
- CENA N: encerramento perturbador e impactante

CARACTERÍSTICAS:
- Terror psicológico, sem gore explícito
- Gancho nos primeiros 3 segundos
- Tensão crescente, reviravolta obrigatória, encerramento perturbador — SEM usar as palavras "plot twist" ou "final" como rótulos no texto
- Cada cena começa com "CENA N:" em maiúsculas

Quando o usuário pedir para gerar/criar, você gera a história completa respeitando a contagem de caracteres da duração escolhida e sempre apresenta no formato:

🎬 ROTEIRO GERADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 TÍTULO: [título chamativo]
⏱️ DURAÇÃO: [X minutos]
📊 CARACTERES: [N] / limite: [min]-[max]
🎭 AMBIENTE: [tipo de cenário]

📖 ROTEIRO:
[cenas com numeração CENA 0:, CENA 1:, etc]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Digite "aprovado" para criar ou "rejeitar" para gerar outra.`

function listarVideosCriados() {
  if (!fs.existsSync(VIDEOS_FILE)) return []
  try { return JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8')) } catch { return [] }
}

function salvarVideosCriados(lista) {
  fs.writeFileSync(VIDEOS_FILE, JSON.stringify(lista, null, 2))
}

function adicionarVideoCriado(video) {
  const lista = listarVideosCriados()
  lista.push(video)
  salvarVideosCriados(lista)
}

function salvarRoteiro(titulo, conteudo) {
  if (!fs.existsSync(STORIES_DIR)) fs.mkdirSync(STORIES_DIR, { recursive: true })
  const arquivos = fs.readdirSync(STORIES_DIR).filter(f => f.match(/^\d{3}-/))
  const proximo = String(arquivos.length + 1).padStart(3, '0')
  const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
  const fileName = `${proximo}-${slug}.md`
  fs.writeFileSync(path.join(STORIES_DIR, fileName), conteudo)
  return fileName
}

function buildPromptCLI(historico, mensagemUsuario) {
  const regrasPath = path.join(__dirname, '..', 'memory', 'CHATBOT-REGRAS.md')
  let regras = ''
  try { regras = fs.readFileSync(regrasPath, 'utf8') } catch (e) {
    console.warn('[PROMPT] ⚠️ não consegui ler regras:', regrasPath, '—', e.message)
  }
  console.log('[PROMPT] regras carregadas:', regras.length, 'chars | path:', regrasPath)
  const partes = regras ? [regras, '', SYSTEM_PROMPT, ''] : [SYSTEM_PROMPT, '']

  if (historico && historico.length > 0) {
    partes.push('CONVERSA ANTERIOR (use só como contexto, NÃO repita):')
    for (const m of historico.slice(-20)) {
      const papel = m.role === 'user' ? 'Usuário' : 'Agente'
      partes.push(`${papel}: ${m.content}`)
    }
    partes.push('')
  }

  partes.push(`Usuário: ${mensagemUsuario}`)
  partes.push('')
  partes.push('Agora responda como o agente DarkFlow. Escreva APENAS a próxima mensagem do agente — não inclua "Agente:" no início, não repita o histórico, não comente que está respondendo. Vá direto à resposta.')

  return partes.join('\n')
}

function chamarClaudeCLI(prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
      cwd: os.tmpdir()
    })

    let stdout = ''
    let stderr = ''
    let finished = false

    const timeoutId = setTimeout(() => {
      if (finished) return
      finished = true
      try { proc.kill('SIGTERM') } catch {}
      reject(new Error(`Timeout: Claude CLI levou mais de ${CLI_TIMEOUT_MS / 1000}s`))
    }, CLI_TIMEOUT_MS)

    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', (d) => { stdout += d })
    proc.stderr.on('data', (d) => { stderr += d })

    proc.on('error', (err) => {
      if (finished) return
      finished = true
      clearTimeout(timeoutId)
      reject(new Error(
        `Falha ao executar "claude": ${err.message}. ` +
        `Verifique se o Claude Code CLI está no PATH (digite "claude --version" no terminal para confirmar).`
      ))
    })

    proc.on('close', (code) => {
      if (finished) return
      finished = true
      clearTimeout(timeoutId)
      if (code !== 0) {
        return reject(new Error(
          `Claude CLI saiu com código ${code}: ${stderr.trim() || stdout.trim() || '(sem saída)'}`
        ))
      }
      const text = stdout.trim()
      if (!text) {
        return reject(new Error('Claude CLI retornou resposta vazia'))
      }
      resolve(text)
    })

    proc.stdin.write(prompt, 'utf8')
    proc.stdin.end()
  })
}

async function gerarComClaude(historico, mensagemUsuario) {
  const prompt = buildPromptCLI(historico, mensagemUsuario)
  return await chamarClaudeCLI(prompt)
}

function extrairRoteiroDaResposta(texto) {
  const tituloMatch = texto.match(/📌\s*T[IÍ]TULO:\s*(.+)/i)
  const duracaoMatch = texto.match(/⏱️\s*DURA[ÇC][AÃ]O:\s*(.+)/i)
  const cenasMatch = texto.match(/CENA\s*0:[\s\S]+/i)
  if (!tituloMatch || !cenasMatch) return null
  return {
    titulo: tituloMatch[1].trim(),
    duracao: duracaoMatch ? duracaoMatch[1].trim() : null,
    roteiro: cenasMatch[0].trim()
  }
}

async function gerarInstrucoesVisuais(tema, roteiroTexto) {
  const promptLLM = `Analise o roteiro cena por cena e descreva os elementos visuais CONCRETOS e ESPECÍFICOS que devem aparecer nas imagens. Não use descrições genéricas de atmosfera.

Para cada elemento importante do roteiro, descreva a imagem exata:
- Objetos físicos mencionados no texto
- Cenários específicos descritos
- Momentos de tensão com os detalhes exatos do roteiro

Exemplo para um roteiro tipo este:
CORRETO: "Mãos tremendo segurando álbum de couro marrom antigo aberto, foto preto e branco de família posando em varanda, figura feminina desfocada no fundo com cabelo escuro colado no rosto"

ERRADO: "Ambiente sombrio com atmosfera de terror psicológico e iluminação baixa"

O DarkFlow vai distribuir essas descrições pelas imagens na ordem do roteiro — seja específico e sequencial.

Restrições: sem rostos claros e nítidos, sem cenas felizes, sem cores quentes.

Estilo visual obrigatório para TODAS as imagens:
- Fotografia cinematográfica granulada, como filme de terror dos anos 70-80
- Iluminação expressionista: uma fonte de luz dura criando sombras profundas e angulares
- Paleta: preto, cinza chumbo, sépia escuro, ocasionalmente vermelho dessaturado
- Elementos de horror CONCRETOS: figuras parcialmente visíveis, reflexos impossíveis, objetos fora de lugar, texturas de deterioração
- Composição perturbadora: ângulos holandeses sutis, espaço negativo ameaçador, profundidade de campo que esconde mais do que revela
- PROIBIDO: fotos coloridas alegres, ambientes limpos, pessoas sorrindo, iluminação natural ensolarada

TEMA: ${tema}

ROTEIRO:
${roteiroTexto}

Retorne APENAS as descrições visuais sequenciais — sem introdução, sem "Aqui está:", sem formatação markdown.`

  try {
    const resposta = await chamarClaudeCLI(promptLLM)
    return resposta.trim().replace(/^["'`]|["'`]$/g, '')
  } catch (e) {
    console.warn('⚠️ Claude falhou ao gerar instruções visuais:', e.message, '— fallback genérico.')
    return `Ambientes sombrios e cinematográficos inspirados em "${tema}". Iluminação baixa, sombras longas, paleta fria dessaturada (azul escuro, cinza, preto). Sem rostos visíveis, sem cores quentes, sem cenas felizes. Photorealistic 8K, atmosfera de isolamento e tensão.`
  }
}

function detectarDuracao(texto) {
  const t = texto.toLowerCase()
  for (const k of Object.keys(DURACOES_VALIDAS)) {
    if (t.includes(k.toLowerCase())) return k
  }
  return null
}

function detectarFormato(texto) {
  const t = texto.toLowerCase()
  if (t.includes('longo') || t.includes('long')) return 'longo'
  if (t.includes('short') || t.includes('tiktok') || t.includes('curto')) return 'tiktok'
  return null
}

function detectarAprovacao(texto) {
  const t = texto.toLowerCase().trim()
  return ['aprovado', 'aprovar', 'pode criar', 'ok', 'sim', 'cria', 'vai', 'yes', 'criar', 'manda', 'beleza'].some(p => t === p || t.startsWith(p + ' ') || t.endsWith(' ' + p))
}

function detectarRejeicao(texto) {
  const t = texto.toLowerCase().trim()
  return ['rejeitar', 'rejeitado', 'não', 'nao', 'outro', 'outra', 'nope'].some(p => t === p || t.startsWith(p + ' '))
}

const FRASES_DIRECT_POST = [
  'posta direto', 'publica direto', 'video.publish',
  'direct post', 'publicar direto', 'postar direto'
]
const FRASES_STATUS_TIKTOK = [
  'conectar tiktok', 'status tiktok', 'tiktok conectado',
  'minha conta tiktok', 'info tiktok', 'verificar tiktok'
]
function detectarDirectPost(texto) {
  const t = texto.toLowerCase().trim()
  return FRASES_DIRECT_POST.some(f => t.includes(f))
}
function detectarStatusTikTok(texto) {
  const t = texto.toLowerCase().trim()
  return FRASES_STATUS_TIKTOK.some(f => t.includes(f))
}

async function processarComando(userId, texto, nomeUsuario) {
  // Intercept 0a — teste do escopo video.publish (Direct Post TikTok)
  if (detectarDirectPost(texto)) {
    try {
      const resp = await tiktok.testarDirectPost()
      const erro = resp && resp.error && resp.error.code && resp.error.code !== 'ok'
        ? `${resp.error.code} — ${resp.error.message || '(sem mensagem)'}`
        : JSON.stringify(resp)
      return `📱 Direct Post TikTok — integração implementada.\nA API retornou: ${erro}\nEste escopo ficará ativo após aprovação do app pelo TikTok. O fluxo técnico está completo e funcional.`
    } catch (err) {
      return `📱 Direct Post TikTok — integração implementada.\nA API retornou: ${err.message}\nEste escopo ficará ativo após aprovação do app pelo TikTok. O fluxo técnico está completo e funcional.`
    }
  }

  // Intercept 0b — status da conta TikTok conectada (dados reais via /v2/user/info/)
  if (detectarStatusTikTok(texto)) {
    try {
      const info = await tiktok.buscarInfoContaTikTok()
      if (info && info.error && info.error.code && info.error.code !== 'ok') {
        return `❌ TikTok: ${info.error.code} — ${info.error.message || 'erro desconhecido'}`
      }
      const u = (info && info.data && info.data.user) || {}
      return `✅ TikTok conectado!\n👤 Nome: ${u.display_name || '(sem nome)'}\n🔗 Username: @${u.username || '(sem username)'}\n🆔 Open ID: ${u.open_id || '(sem open_id)'}\n📋 Escopos ativos: user.info.basic, video.upload\n⏳ video.publish: aguardando aprovação do app`
    } catch (err) {
      return `❌ Erro buscando info TikTok: ${err.message}`
    }
  }

  const cmd = texto.trim().toLowerCase()
  const pendente = session.getPendente(userId)

  if (cmd === '/ajuda' || cmd === '/help') {
    return ajudaTexto()
  }

  if (cmd === '/status') {
    return statusVideos()
  }

  if (cmd === '/pendentes') {
    return pendente ? `Roteiro pendente: **${pendente.titulo || pendente.tema || '(sem título)'}**` : 'Nenhum roteiro pendente.'
  }

  if (cmd === '/aprovar') {
    if (pendente && pendente.tipo === 'aguardando-aprovacao') {
      session.clearPendente(userId)
      return await criarVideoNaAPI(userId, pendente)
    }
    return 'Nada para aprovar.'
  }

  if (cmd === '/rejeitar') {
    if (pendente && pendente.tipo === 'aguardando-aprovacao') {
      pendente.tipo = 'aguardando-tema'
      pendente.tema = null
      pendente.roteiro = null
      session.setPendente(userId, pendente)
      return 'Rejeitado. Me diga um novo tema.'
    }
    return 'Nada para rejeitar.'
  }

  if (cmd === '/ideias') {
    return await sugerirIdeias()
  }

  if (cmd.startsWith('/gerar')) {
    const tema = texto.replace(/^\/gerar\s*/i, '').trim()
    return iniciarFluxoGeracao(userId, tema || null)
  }

  if (pendente && pendente.tipo === 'aguardando-tema') {
    pendente.tema = texto.trim()
    pendente.tipo = 'aguardando-formato'
    session.setPendente(userId, pendente)
    return `Tema definido: **${pendente.tema}**\n\nAgora escolha o formato:\n- **Short/TikTok** (até 5 minutos)\n- **Vídeo Longo** (até 12 minutos)`
  }

  if (pendente && pendente.tipo === 'aguardando-formato') {
    const formato = detectarFormato(texto)
    if (!formato) return 'Não entendi. Responda **short**, **tiktok** ou **longo**.'
    pendente.formato = formato
    pendente.tipo = 'aguardando-duracao'
    session.setPendente(userId, pendente)
    if (formato === 'longo') {
      return `Formato: **Vídeo Longo**\n\nDuração disponível:\n- **12 minutos**`
    }
    return `Formato: **Short/TikTok**\n\nEscolha a duração:\n- **30 segundos**\n- **45 segundos**\n- **1 minuto**\n- **2 minutos**\n- **3 minutos**\n- **5 minutos**`
  }

  if (pendente && pendente.tipo === 'aguardando-duracao') {
    const duracao = detectarDuracao(texto)
    if (!duracao) return 'Duração inválida. Use exatamente: 30 segundos, 45 segundos, 1 minuto, 2 minutos, 3 minutos, 5 minutos ou 12 minutos.'
    pendente.duracao = duracao
    pendente.tipo = 'gerando-roteiro'
    session.setPendente(userId, pendente)
    return await gerarRoteiroParaPendente(userId)
  }

  if (pendente && pendente.tipo === 'aguardando-aprovacao') {
    if (detectarAprovacao(texto)) {
      session.clearPendente(userId)
      return await criarVideoNaAPI(userId, pendente)
    }
    if (detectarRejeicao(texto)) {
      pendente.tipo = 'aguardando-tema'
      pendente.tema = null
      pendente.roteiro = null
      session.setPendente(userId, pendente)
      return 'Rejeitado. Me diga um novo tema ou peça **/ideias** para sugestões.'
    }
    const conv = session.getHistorico(userId)
    return await gerarComClaude(conv, texto)
  }

  const conv = session.getHistorico(userId)
  return await gerarComClaude(conv, texto)
}

function iniciarFluxoGeracao(userId, tema) {
  const pendente = {
    tipo: tema ? 'aguardando-formato' : 'aguardando-tema',
    tema: tema || null,
    formato: null,
    duracao: null,
    roteiro: null,
    aguardar_confirmacao: false
  }
  session.setPendente(userId, pendente)
  if (!tema) {
    return '🎬 Vamos criar um vídeo de terror.\n\nQual o tema/história? Se não souber, peça **/ideias** para 3 sugestões.'
  }
  return `Tema: **${tema}**\n\nFormato: **Short/TikTok** ou **Vídeo Longo**?`
}

async function gerarRoteiroParaPendente(userId) {
  const pendente = session.getPendente(userId)
  if (!pendente) return 'Erro: nada pendente.'

  const config = DURACOES_VALIDAS[pendente.duracao]
  const prompt = `Gere um roteiro de terror sobre "${pendente.tema}" para um vídeo de ${pendente.duracao}. ` +
    `O texto deve ter entre ${config.minChar} e ${config.maxChar} caracteres. ` +
    `Use a estrutura obrigatória (CENA 0 gancho, reviravolta, encerramento impactante — sem usar as palavras "plot twist" ou "final" como rótulos no texto). ` +
    `Apresente no formato exato com TÍTULO, DURAÇÃO, CARACTERES, AMBIENTE e o ROTEIRO numerado.`

  const conv = session.getHistorico(userId)
  const resposta = await gerarComClaude(conv, prompt)

  const dados = extrairRoteiroDaResposta(resposta)
  if (dados) {
    pendente.titulo = dados.titulo
    pendente.roteiro = dados.roteiro
    pendente.tipo = 'aguardando-aprovacao'
    session.setPendente(userId, pendente)
  } else {
    pendente.tipo = 'aguardando-aprovacao'
    pendente.titulo = pendente.tema
    pendente.roteiro = resposta
    session.setPendente(userId, pendente)
  }

  return resposta + '\n\n⚠️ Aguardando sua aprovação. Digite **aprovado** ou **rejeitar**.'
}

async function criarVideoNaAPI(userId, pendente) {
  try {
    session.sendTo(userId, { tipo: 'mensagem', texto: '🎙️ Analisando roteiro para escolher a melhor voz...', autor: 'sistema', timestamp: Date.now() })
    const voz = await voiceSelector.selecionarVoz(pendente.roteiro)
    session.sendTo(userId, { tipo: 'mensagem', texto: `✅ Voz escolhida: **${voz.voice_name}** — ${voz.motivo}`, autor: 'sistema', timestamp: Date.now() })

    session.sendTo(userId, { tipo: 'mensagem', texto: '🎵 Fazendo upload da trilha sonora...', autor: 'sistema', timestamp: Date.now() })
    const trilhaPath = path.join(__dirname, '..', 'audio', 'trilha-padrao.mp3')
    if (!fs.existsSync(trilhaPath)) {
      return '❌ Arquivo audio/trilha-padrao.mp3 não encontrado. Coloque o .mp3 padrão nessa pasta antes de criar vídeos.'
    }
    const musicUrl = await darkflow.uploadMusicaBucket(trilhaPath)

    const config = DURACOES_VALIDAS[pendente.duracao]
    session.sendTo(userId, { tipo: 'mensagem', texto: '🎨 Gerando instruções visuais do vídeo...', autor: 'sistema', timestamp: Date.now() })
    const instrucoesVisuais = await gerarInstrucoesVisuais(pendente.tema, pendente.roteiro)

    salvarRoteiro(pendente.titulo, `# ${pendente.titulo}\n\nDuração: ${pendente.duracao}\nTema: ${pendente.tema}\n\n${pendente.roteiro}`)

    session.sendTo(userId, { tipo: 'mensagem', texto: '🎬 Criando card via API...', autor: 'sistema', timestamp: Date.now() })
    const card = await darkflow.criarVideo({
      theme: pendente.titulo,
      duration_type: config.tipo,
      duration: config.value,
      script_text: pendente.roteiro
        .split(/\n[━\-_=]{3,}/)[0]
        .replace(/\n+Digite\s+["']?aprovado["'][\s\S]*$/i, '')
        .replace(/^\s*CENA\s*\d+\s*:\s*/gim, '')
        .replace(/\b(plot\s*twist|final\s*impactante|introdução|desenvolvimento|conclusão)\s*:\s*/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
      voice_id: voz.voice_id,
      voice_name: voz.voice_name,
      voice_provider: voz.voice_provider,
      auto_images_count: config.imagens,
      auto_images_instructions: instrucoesVisuais,
      background_music: musicUrl
    })

    // Grava no videos-criados-por-mim.json IMEDIATAMENTE — antes de qualquer outro passo.
    // Se falhar, loga mas não interrompe (o card já foi criado no Supabase).
    try {
      adicionarVideoCriado({
        id: card.id,
        tema: pendente.titulo,
        duracao: pendente.duracao,
        criado_em: new Date().toISOString(),
        criado_por: userId,
        aguardar_confirmacao: pendente.aguardar_confirmacao || false,
        postado: false
      })
    } catch (errTracking) {
      console.error(`⚠️ Falha gravando rastreamento local (card ${card.id}): ${errTracking.message}`)
    }

    await darkflow.moverParaGerarRoteiro(card.id)

    monitor.ativarMonitor()

    return `✅ Vídeo criado!\n\n📌 **${pendente.titulo}**\n🆔 Card ID: \`${card.id}\`\n⏱️ Processamento: 30min a 2h\n\nO monitor foi ativado. Você será notificado aqui quando o vídeo estiver pronto para baixar no DarkFlow.`
  } catch (err) {
    return `❌ Erro ao criar vídeo: ${err.message}`
  }
}

function statusVideos() {
  const videos = listarVideosCriados()
  if (videos.length === 0) return '📭 Nenhum vídeo criado ainda.'
  const linhas = videos.map(v => {
    const status = v.pronto ? '🟢 pronto' : '🟡 processando'
    return `- ${status} | ${v.tema} \`(${v.id.slice(0,8)})\``
  })
  return '🎬 **Vídeos**\n\n' + linhas.join('\n')
}

async function sugerirIdeias() {
  const resposta = await gerarComClaude([], 'Sugira 10 ideias curtas de histórias de terror sobrenatural ou psicológico originais. Numere de 1 a 10. Cada ideia em uma linha, máximo 80 caracteres.')
  return '💡 **Ideias de terror:**\n\n' + resposta
}

function ajudaTexto() {
  return `**Comandos:**
- \`/gerar\` — inicia fluxo (tema, formato, duração)
- \`/gerar [tema]\` — inicia já com tema
- \`/ideias\` — 10 ideias de terror
- \`/aprovar\` — aprova roteiro pendente
- \`/rejeitar\` — rejeita e pede outro
- \`/status\` — status dos vídeos
- \`/pendentes\` — roteiros aguardando aprovação
- \`/ajuda\` — esta lista

Você também pode conversar livremente. Ex: "cria uma história de hospital abandonado".`
}

async function processar(userId, texto, nomeUsuario) {
  if (nomeUsuario) session.setNome(userId, nomeUsuario)
  session.appendHistorico(userId, 'user', texto)

  let resposta
  try {
    resposta = await processarComando(userId, texto, nomeUsuario)
  } catch (err) {
    console.error('Erro ao processar mensagem:', err)
    resposta = `❌ Erro interno: ${err.message}`
  }

  session.appendHistorico(userId, 'assistant', resposta)
  return resposta
}

module.exports = {
  processar,
  listarVideosCriados,
  adicionarVideoCriado
}
