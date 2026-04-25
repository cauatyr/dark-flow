const fs = require('fs')
const fetch = require('node-fetch')
const { getValidAccessToken, getSupabaseConfig } = require('./auth-darkflow')

// Flag temporária: quando true, força DarkVI/Ronald ignorando a voz que o agente escolheu.
// Mudar para false quando ElevenLabs voltar ao normal.
const ELEVENLABS_FORA = true

// Duração (string → segundos). Usado em calcularIntervalImagens.
// Mesma lista do server/chat.js DURACOES_VALIDAS.
const DURACAO_SEGUNDOS = {
  '30-segundos': 30,
  '45-segundos': 45,
  '1-minuto': 60,
  '2-minutos': 120,
  '3-minutos': 180,
  '5-minutos': 300,
  '12-minutos': 720
}

// Calcula auto_images_interval pra cobrir a duração inteira do vídeo.
// Sem isso, as imagens cobrem só (count × interval) segundos e o resto
// fica sem imagem fresca (descoberto comparando cards em 2026-04-23).
function calcularIntervalImagens(duration, count) {
  const segs = DURACAO_SEGUNDOS[duration]
  if (!segs || !count) return 5
  return Math.max(1, Math.round(segs / count))
}

async function criarVideo(opts) {
  const accessToken = await getValidAccessToken()
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, userId: USER_ID } = getSupabaseConfig()

  if (ELEVENLABS_FORA && (opts.voice_provider === 'elevenlabs' || !opts.voice_provider)) {
    console.warn(`⚠️  ElevenLabs fora — forçando DarkVI/Ronald (voz original: ${opts.voice_name || '(não definida)'} / ${opts.voice_id || '(sem id)'})`)
    opts.voice_provider = 'darkvi'
    opts.voice_id = 'cfefb4d6-f863-47ba-a1a4-ef8178410da7'
    opts.voice_name = 'Ronald'
  }

  const body = {
    theme: opts.theme,
    theme_type: 'roteiro_pronto',
    status: 'videos-a-fazer',
    duration_type: opts.duration_type,
    duration: opts.duration,
    script_text: opts.script_text,
    voice_provider: opts.voice_provider || 'elevenlabs',
    voice_name: opts.voice_name,
    voice: opts.voice_id,
    auto_subtitles: true,
    subtitle_color: 'Amarelo',
    subtitle_settings: opts.subtitle_settings || {
      bold: false,
      color: '#FFFF00',
      italic: false,
      enabled: true,
      outline: true,
      fontSize: 50,
      position: 'bottom',
      textAlign: 'center',
      fontFamily: 'Inter',
      displayMode: 'full',
      captionStyle: 'tiktok-center',
      outlineColor: '#000000',
      backgroundColor: 'transparent',
      wordsPerDisplay: 99,
      backgroundOpacity: 70
    },
    auto_images_count: opts.auto_images_count,
    auto_images_interval: calcularIntervalImagens(opts.duration, opts.auto_images_count),
    auto_images_instructions: opts.auto_images_instructions,
    auto_images_provider: 'h200',
    visual_images_mode: 'auto_outline',
    background_music: opts.background_music,
    language: 'pt-BR',
    user_id: USER_ID
  }

  if (!body.voice) throw new Error('voice (voice_id) obrigatório')
  if (!body.voice_name) throw new Error('voice_name obrigatório')
  if (!body.background_music) throw new Error('background_music obrigatório')
  if (!body.script_text) throw new Error('script_text obrigatório')
  if (!body.auto_images_instructions || body.auto_images_instructions.trim().length < 50) {
    throw new Error('auto_images_instructions obrigatório (>= 50 chars) — diretor de fotografia por vídeo')
  }
  if (!body.subtitle_settings || body.subtitle_settings.enabled !== true) {
    throw new Error('subtitle_settings.enabled deve ser true (burn-in da legenda no MP4)')
  }
  if (body.auto_images_count % 5 !== 0) {
    throw new Error(`auto_images_count deve ser múltiplo de 5 (recebido: ${body.auto_images_count})`)
  }
  if (body.subtitle_color !== 'Amarelo' || body.auto_subtitles !== true) {
    throw new Error('Legenda deve ser auto_subtitles=true e subtitle_color=Amarelo')
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/video_cards?select=*`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    }
  )

  if (response.status !== 201) {
    const errorText = await response.text()
    throw new Error(`Falha ao criar vídeo (status ${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const card = Array.isArray(data) ? data[0] : data
  if (!card || !card.id) throw new Error('Card criado mas ID não retornado')

  console.log(`✅ Vídeo criado com ID: ${card.id}`)
  return card
}

async function moverParaGerarRoteiro(cardId) {
  const accessToken = await getValidAccessToken()
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseConfig()

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/video_cards?id=eq.${cardId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'gerar-roteiro' })
    }
  )

  if (response.status !== 200 && response.status !== 204) {
    const errorText = await response.text()
    throw new Error(`Falha ao mover card (status ${response.status}): ${errorText}`)
  }

  console.log(`✅ Card ${cardId} movido para gerar-roteiro`)
  return true
}

async function checarStatusCard(cardId) {
  const accessToken = await getValidAccessToken()
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseConfig()

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/video_cards?id=eq.${cardId}&select=id,theme,status,download_url,duration,progress,progress_message`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Falha ao consultar card: ${response.status}`)
  }
  const data = await response.json()
  return data[0] || null
}

async function buscarCard(cardId) {
  return await checarStatusCard(cardId)
}

async function uploadMusicaBucket(caminhoArquivo) {
  const accessToken = await getValidAccessToken()
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, userId: USER_ID } = getSupabaseConfig()

  if (!fs.existsSync(caminhoArquivo)) {
    throw new Error(`Arquivo não encontrado: ${caminhoArquivo}`)
  }

  const randomId = Math.random().toString(36).substring(7)
  const fileName = `${USER_ID}-${randomId}.mp3`
  const fileBuffer = fs.readFileSync(caminhoArquivo)

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'audio/mpeg'
      },
      body: fileBuffer
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Erro upload da música (status ${response.status}): ${errorText}`)
  }

  const musicUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`
  console.log(`✅ Trilha enviada: ${musicUrl}`)
  return musicUrl
}

async function downloadVideo(cardId, destPath) {
  const card = await checarStatusCard(cardId)
  if (!card || !card.download_url) {
    throw new Error(`Vídeo ainda não tem URL para download (card ${cardId})`)
  }
  const response = await fetch(card.download_url)
  if (!response.ok) throw new Error(`Falha ao baixar vídeo: ${response.status}`)
  const buffer = await response.buffer()
  fs.writeFileSync(destPath, buffer)
  console.log(`✅ Vídeo baixado: ${destPath}`)
  return destPath
}

// Dispara o render final de um card que está em status=gerar-video, progress=100, progress_message=null.
// Reproduz os 2 PATCHes que a UI do DarkFlow faz no clique do botão "Gerar Vídeo".
// Fingerprint capturada via spy Playwright em 2026-04-23.
async function dispararRender(cardId) {
  const accessToken = await getValidAccessToken()
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseConfig()
  const H = {
    'Authorization': `Bearer ${accessToken}`,
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  }

  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/video_cards?id=eq.${cardId}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({
      progress: 5,
      progress_message: 'Iniciando geração de vídeo...',
      has_error: false,
      video_generation_triggered: true,
      download_url: null,
      job_id: null,
      status_url: null,
      generation_lock: false,
      generation_lock_timestamp: null
    })
  })
  if (r1.status !== 204 && r1.status !== 200) {
    throw new Error(`PATCH 1 falhou (${r1.status}): ${await r1.text()}`)
  }

  await new Promise(r => setTimeout(r, 1600))

  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/video_cards?id=eq.${cardId}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ retry_count: 0, has_error: false, error_logs: null })
  })
  if (r2.status !== 204 && r2.status !== 200) {
    throw new Error(`PATCH 2 falhou (${r2.status}): ${await r2.text()}`)
  }

  console.log(`✅ Render disparado no card ${cardId}`)
  return true
}

module.exports = {
  criarVideo,
  moverParaGerarRoteiro,
  checarStatusCard,
  buscarCard,
  uploadMusicaBucket,
  downloadVideo,
  dispararRender
}
