const fetch = require('node-fetch')
const { getValidAccessToken, SUPABASE_URL, SUPABASE_ANON_KEY } = require('./auth-darkflow')

// Flag temporária: quando true, pula consulta à ElevenLabs e retorna Ronald/DarkVI direto.
// Manter sincronizada com a flag em api/darkflow_api.js. Mudar para false quando ElevenLabs voltar.
const ELEVENLABS_FORA = true

const VOICES_ENDPOINT = `${SUPABASE_URL}/functions/v1/elevenlabs-list-voices`
const PROVIDER = 'elevenlabs'

async function buscarTodasAsVozes() {
  const token = await getValidAccessToken()

  const response = await fetch(VOICES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ language: 'pt' })
  })

  if (!response.ok) {
    throw new Error(`Falha ao buscar vozes (status ${response.status}): ${await response.text()}`)
  }

  const data = await response.json()
  const lista = data.voices || []
  if (!lista.length) {
    throw new Error('elevenlabs-list-voices retornou lista vazia para language=pt')
  }

  const vozes = lista.map(v => ({
    id:       v.voiceId,
    nome:     v.name || '',
    desc:     v.description || '',
    category: v.category || '',
    gender:   v.gender || '',
    provider: PROVIDER
  }))

  console.log(`✅ ${vozes.length} vozes PT carregadas de elevenlabs-list-voices`)
  return vozes
}

function analisarRoteiro(roteiro) {
  const texto = roteiro.toLowerCase()

  const atmosferico = [
    'floresta', 'cemitério', 'casa abandonada', 'escuridão', 'neblina',
    'noite', 'vento', 'sombra', 'silêncio', 'antigo', 'maldição', 'ruína'
  ]
  const psicologico = [
    'mente', 'loucura', 'memória', 'realidade', 'sonho', 'ilusão',
    'paranoia', 'esqueci', 'não me lembro', 'verdade', 'identidade'
  ]
  const intimo = [
    'eu ', 'minha ', 'meu ', 'acordei', 'senti', 'olhei', 'percebi',
    'sozinho', 'solidão', 'medo de', 'não consigo'
  ]
  const cotidiano = [
    'vizinho', 'trabalho', 'escola', 'família', 'rotina',
    'todo dia', 'aplicativo', 'celular', 'cidade', 'apartamento'
  ]

  const scores = {
    atmosferico: atmosferico.filter(p => texto.includes(p)).length,
    psicologico: psicologico.filter(p => texto.includes(p)).length,
    intimo:      intimo.filter(p => texto.includes(p)).length,
    cotidiano:   cotidiano.filter(p => texto.includes(p)).length
  }

  const tipo = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]
  const duracao = roteiro.length < 600 ? 'curta' : 'longa'

  console.log(`📖 Análise: tipo=${tipo} duração=${duracao}`)
  console.log('   Scores:', scores)

  return { tipo, duracao, scores }
}

function escolherMelhorVoz(roteiro, vozes) {
  const analise = analisarRoteiro(roteiro)

  const pontuadas = vozes.map(voz => {
    let pontos = 0
    const texto = [voz.nome, voz.desc, voz.category, voz.gender].join(' ').toLowerCase()

    if (analise.tipo === 'atmosferico') {
      if (/deep|grave|dark|gravelly|sombr|resonant|atmospheric/.test(texto)) pontos += 3
      if (/calm|slow|pausad|powerful|narrat/.test(texto))                    pontos += 2
    }
    if (analise.tipo === 'psicologico') {
      if (/dramatic|intense|confident|resonant|imposing|epic|captivating|serious/.test(texto)) pontos += 3
      if (/deep|powerful|marcante|authority|striking|narrat/.test(texto))                       pontos += 2
    }
    if (analise.tipo === 'intimo') {
      if (/soft|tender|whisper|gentle|suave|warm|velvety|intimate|empathetic/.test(texto)) pontos += 3
      if (/calm|smooth|young|sweet|pleasant|narrat/.test(texto))                           pontos += 2
    }
    if (analise.tipo === 'cotidiano') {
      if (/conversational|natural|brazilian|narrat|casual|friendly|relaxed/.test(texto)) pontos += 3
    }

    if (analise.duracao === 'curta') {
      if (/vibrant|cheerful|energetic|dynamic|youthful|young/.test(texto)) pontos += 2
      if (/social|podcast/.test(texto))                                    pontos += 1
    }
    if (analise.duracao === 'longa') {
      if (/slow|deep|calm|pausad|audiobook|ebook|storytelling|narrative/.test(texto)) pontos += 2
    }

    // Preferir category=professional / high_quality para qualidade consistente
    if (voz.category === 'professional' || voz.category === 'high_quality') pontos += 1

    // Penalizações para vozes menos adequadas a terror
    if (/cheerful|happy|playful|fun|cartoon|childish|noel|sales|retail|advertisement/.test(texto)) pontos -= 2

    return { ...voz, pontos }
  })

  pontuadas.sort((a, b) => b.pontos - a.pontos)

  console.log('🏆 Top 5 do ranking:')
  pontuadas.slice(0, 5).forEach((v, i) =>
    console.log(`  ${i + 1}. ${v.nome} (${v.gender}, ${v.category}) — ${v.pontos} pontos`)
  )

  const escolhida = pontuadas[0]
  const motivo = gerarMotivo(escolhida, analise)
  console.log(`✅ Voz escolhida: ${escolhida.nome} — ${motivo}`)

  return { ...escolhida, motivo }
}

function gerarMotivo(voz, analise) {
  const map = {
    atmosferico: 'grave e envolvente, ideal para terror atmosférico',
    psicologico: 'intensa e marcante, perfeita para terror psicológico',
    intimo:      'suave e perturbadora, ideal para narrativa em primeira pessoa',
    cotidiano:   'natural e narrativa, perfeita para terror no cotidiano'
  }
  return map[analise.tipo] || 'melhor disponível para este roteiro'
}

async function selecionarVoz(roteiro) {
  if (ELEVENLABS_FORA) {
    console.warn('⚠️  ElevenLabs fora — retornando Ronald/DarkVI direto (sem consultar voice_catalog)')
    return {
      voice_id:       'cfefb4d6-f863-47ba-a1a4-ef8178410da7',
      voice_name:     'Ronald',
      voice_provider: 'darkvi',
      motivo:         'fallback DarkVI enquanto ElevenLabs está fora'
    }
  }
  const vozes = await buscarTodasAsVozes()
  const escolhida = escolherMelhorVoz(roteiro, vozes)
  return {
    voice_id:       escolhida.id,
    voice_name:     escolhida.nome,
    voice_provider: escolhida.provider,
    motivo:         escolhida.motivo
  }
}

module.exports = { selecionarVoz, buscarTodasAsVozes, analisarRoteiro, escolherMelhorVoz }
