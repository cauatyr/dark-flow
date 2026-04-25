require('dotenv').config()
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const ENV_PATH = path.join(__dirname, '..', '.env')
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET

// ─────────────────────────────────────────────────────────────
// Leitura/escrita de tokens no .env (single source of truth)
// ─────────────────────────────────────────────────────────────

function atualizarEnv(updates) {
  let env = fs.readFileSync(ENV_PATH, 'utf8')
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(env)) {
      env = env.replace(regex, `${key}=${value}`)
    } else {
      env = env.trimEnd() + `\n${key}=${value}\n`
    }
  }
  fs.writeFileSync(ENV_PATH, env)
}

// ─────────────────────────────────────────────────────────────
// Renovação de token
// ─────────────────────────────────────────────────────────────

async function renovarTokenTikTok() {
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    throw new Error('TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET ausentes no .env')
  }
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN
  if (!refreshToken) {
    throw new Error('TIKTOK_REFRESH_TOKEN ausente no .env — rode scripts/tiktok-oauth.js para obter')
  }

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  })
  const data = await res.json()
  if (data.error || !data.access_token) {
    throw new Error('Falha ao renovar token TikTok: ' + JSON.stringify(data))
  }

  atualizarEnv({
    TIKTOK_ACCESS_TOKEN: data.access_token,
    TIKTOK_REFRESH_TOKEN: data.refresh_token || refreshToken,
  })
  // Refresca process.env na mesma instância do node
  process.env.TIKTOK_ACCESS_TOKEN = data.access_token
  if (data.refresh_token) process.env.TIKTOK_REFRESH_TOKEN = data.refresh_token

  console.log('✅ Token TikTok renovado')
  return data.access_token
}

// JWT do TikTok NÃO é padrão (token opaco em algumas versões); tentamos
// decode mas em caso de falha assumimos válido e só renovamos sob erro.
async function getTokenTikTok() {
  const token = process.env.TIKTOK_ACCESS_TOKEN
  if (!token) return await renovarTokenTikTok()

  try {
    const parte = token.split('.')[1]
    if (parte) {
      const payload = JSON.parse(Buffer.from(parte, 'base64').toString())
      const expirado = Date.now() / 1000 > (payload.exp || 0) - 60
      if (!expirado) return token
      return await renovarTokenTikTok()
    }
  } catch {
    // token opaco (não é JWT) — assume válido e só renova em 401 na API
  }
  return token
}

// ─────────────────────────────────────────────────────────────
// Upload real via API oficial (init → PUT → status/fetch)
// Mesmo em sandbox do TikTok Developer, escopo video.upload envia
// rascunho REAL pra inbox do dono da conta (apenas visibilidade restrita).
// ─────────────────────────────────────────────────────────────

async function uploadTikTok(videoPath, titulo, descricao) {
  if (!fs.existsSync(videoPath)) throw new Error(`Vídeo não encontrado: ${videoPath}`)
  const accessToken = await getTokenTikTok()
  const stat = fs.statSync(videoPath)
  const videoSize = stat.size

  console.log(`📱 TikTok upload: ${videoPath} (${(videoSize/1024/1024).toFixed(1)} MB)`)

  // Passo 1 — init: obter upload_url + publish_id
  const initResp = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  })
  const initData = await initResp.json()
  console.log('TikTok init response:', JSON.stringify(initData, null, 2))
  if (!initResp.ok) {
    throw new Error(`Falha init upload TikTok (HTTP ${initResp.status}): ${JSON.stringify(initData)}`)
  }
  if (initData.error && initData.error.code !== 'ok') {
    throw new Error(`Erro init TikTok: ${JSON.stringify(initData.error)}`)
  }
  if (!initData.data || !initData.data.upload_url || !initData.data.publish_id) {
    throw new Error(`TikTok init sem upload_url/publish_id: ${JSON.stringify(initData)}`)
  }

  const publishId = initData.data.publish_id
  const uploadUrl = initData.data.upload_url

  // Passo 2 — PUT do arquivo de vídeo
  const videoBuffer = fs.readFileSync(videoPath)
  const uploadResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: videoBuffer,
  })
  console.log(`TikTok PUT upload: HTTP ${uploadResp.status}`)
  if (!uploadResp.ok) {
    throw new Error(`Falha PUT upload TikTok: ${uploadResp.status} ${await uploadResp.text()}`)
  }

  // Passo 3 — polling do status até SEND_TO_USER_INBOX / FAILED
  let statusFinal = null
  for (let tentativa = 1; tentativa <= 10; tentativa++) {
    await new Promise(r => setTimeout(r, 3000))
    const statusResp = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publish_id: publishId }),
    })
    const statusData = await statusResp.json()
    console.log(`TikTok status (tentativa ${tentativa}/10):`, JSON.stringify(statusData, null, 2))

    const s = statusData.data && statusData.data.status
    if (s === 'SEND_TO_USER_INBOX') {
      statusFinal = s
      break
    }
    // Opção B: bytes 100% entregues = sucesso antecipado (TikTok finaliza no servidor em 5-30min).
    const uploadedBytes = statusData.data && statusData.data.uploaded_bytes
    if (s === 'PROCESSING_UPLOAD' && uploadedBytes === videoSize) {
      console.log(`✓ Bytes entregues (${videoSize}B) — TikTok processando no servidor, sucesso antecipado`)
      statusFinal = 'UPLOADED_PROCESSING'
      break
    }
    if (s === 'FAILED') {
      throw new Error(`TikTok publish FAILED: ${JSON.stringify(statusData.data)}`)
    }
  }

  if (!statusFinal) {
    throw new Error(`TikTok timeout (10×3s) — publish_id ${publishId} ainda processando`)
  }

  console.log(`✅ TikTok: vídeo enviado com sucesso — publish_id=${publishId} (status=${statusFinal})`)
  return {
    sandbox: false,
    sucesso: true,
    status: statusFinal === 'SEND_TO_USER_INBOX' ? 'inbox' : 'uploaded_processing',
    publish_id: publishId,
    titulo,
    mensagem: '✅ TikTok: vídeo enviado com sucesso — abra o app TikTok na aba Notificações para revisar e publicar',
  }
}

// ─────────────────────────────────────────────────────────────
// Direct Post (escopo video.publish) — testa disponibilidade do escopo.
// Retorna o payload bruto da API; provavelmente scope_not_authorized
// enquanto o app não for aprovado pelo TikTok.
// ─────────────────────────────────────────────────────────────

async function testarDirectPost() {
  const token = await getTokenTikTok()
  const res = await fetch(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        post_info: {
          title: 'Teste Direct Post',
          privacy_level: 'SELF_ONLY',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: 1,
          chunk_size: 1,
          total_chunk_count: 1
        }
      })
    }
  )
  const data = await res.json()
  return data
}

// ─────────────────────────────────────────────────────────────
// Info real da conta TikTok conectada (display_name, username, etc)
// ─────────────────────────────────────────────────────────────

async function buscarInfoContaTikTok() {
  const token = await getTokenTikTok()
  const res = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
    {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }
  )
  const data = await res.json()
  return data
}

module.exports = {
  uploadTikTok,
  uploadVideo: uploadTikTok,   // alias legado (monitor-videos + upload-tiktok usam uploadVideo)
  getTokenTikTok,
  renovarTokenTikTok,
  testarDirectPost,
  buscarInfoContaTikTok,
}
