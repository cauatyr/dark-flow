#!/usr/bin/env node
require('dotenv').config()

const http = require('http')
const net = require('net')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const fetch = require('node-fetch')
const crypto = require('crypto')
const { URL } = require('url')

// ─── Config ─────────────────────────────────────────────────
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET
// Redirect precisa ser HTTPS pública cadastrada no TikTok console.
// TikTok sandbox NÃO aceita localhost — use localhost.run, cloudflared
// ou ngrok e cole a URL pública aqui via TIKTOK_REDIRECT_URI no .env.
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI
// Porta local que o túnel vai encaminhar para cá. Default 3000 (padrão
// do DarkFlow server); se o server estiver rodando, pare antes ou use
// outra porta (definida via TIKTOK_OAUTH_PORT no .env).
const LOCAL_PORT = parseInt(process.env.TIKTOK_OAUTH_PORT || '3000', 10)
const ENV_PATH = path.join(__dirname, '..', '.env')
const TIMEOUT_MS = 5 * 60 * 1000
// Sandbox só permite user.info.basic. video.upload/video.publish exigem
// aprovação do app em produção.
const SCOPE = 'user.info.basic'

function fatal(msg) {
  console.error('❌ ' + msg)
  process.exit(1)
}

if (!CLIENT_KEY || !CLIENT_SECRET) {
  fatal('TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET precisam estar no .env antes de rodar.')
}
if (!REDIRECT_URI) {
  fatal(
    'TIKTOK_REDIRECT_URI ausente no .env. Abra um túnel HTTPS (ex: ssh -R 80:localhost:' + LOCAL_PORT + ' nokey@localhost.run, ou cloudflared tunnel --url http://localhost:' + LOCAL_PORT + '), cadastre a URL no console do TikTok como redirect URI (ex: https://xxxx.lhr.life/oauth/tiktok/callback), e cole no .env: TIKTOK_REDIRECT_URI=https://xxxx.lhr.life/oauth/tiktok/callback'
  )
}

// ─── Helpers ────────────────────────────────────────────────

function portaLivre(port) {
  return new Promise(resolve => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '127.0.0.1')
  })
}

function abrirBrowser(url) {
  const platform = process.platform
  if (platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
  else if (platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
}

function atualizarEnv(updates) {
  let env = fs.readFileSync(ENV_PATH, 'utf8')
  for (const [k, v] of Object.entries(updates)) {
    const regex = new RegExp(`^${k}=.*$`, 'm')
    if (regex.test(env)) env = env.replace(regex, `${k}=${v}`)
    else env = env.trimEnd() + `\n${k}=${v}\n`
  }
  fs.writeFileSync(ENV_PATH, env)
}

function construirAuthUrl(state) {
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
  url.searchParams.set('client_key', CLIENT_KEY)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('state', state)
  return url.toString()
}

async function trocarCodePorTokens(code) {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  })
  const data = await res.json()
  if (data.error || !data.access_token) {
    throw new Error('Falha ao trocar code por tokens: ' + JSON.stringify(data))
  }
  return data
}

function paginaSucesso() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>TikTok OAuth OK</title>
<style>body{font-family:system-ui;background:#0a0a0a;color:#ede9e3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#171717;border:1px solid #fe2c55;padding:40px;border-radius:8px;text-align:center}
h1{color:#fe2c55;margin:0 0 16px}</style></head>
<body><div class="card"><h1>✅ TikTok autorizado (sandbox)</h1>
<p>Tokens salvos no <code>.env</code>.</p>
<p>Pode fechar essa aba e voltar pro terminal.</p></div></body></html>`
}

function paginaErro(msg) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>TikTok OAuth FAIL</title>
<style>body{font-family:system-ui;background:#0a0a0a;color:#ede9e3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#171717;border:1px solid #fe2c55;padding:40px;border-radius:8px;text-align:center;max-width:600px}
h1{color:#fe2c55;margin:0 0 16px}pre{background:#0a0a0a;padding:12px;border-radius:4px;text-align:left;overflow-x:auto}</style></head>
<body><div class="card"><h1>❌ Falhou</h1><pre>${msg}</pre></div></body></html>`
}

// ─── Fluxo ───────────────────────────────────────────────────

;(async () => {
  if (!await portaLivre(LOCAL_PORT)) {
    fatal(`Porta ${LOCAL_PORT} ocupada. Pare o servidor DarkFlow ou defina TIKTOK_OAUTH_PORT no .env com outra porta (e ajuste o túnel pra apontar pra ela).`)
  }

  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = construirAuthUrl(state)

  console.log('🎬 DarkFlow — TikTok OAuth (sandbox)\n')
  console.log('🔗 URL de autorização:\n')
  console.log('   ' + authUrl + '\n')
  console.log(`   Parâmetros:\n     client_key = ${CLIENT_KEY}\n     redirect_uri = ${REDIRECT_URI}\n     scope = ${SCOPE}\n     response_type = code\n     state = ${state}\n`)

  const callbackPath = new URL(REDIRECT_URI).pathname
  const timeoutId = setTimeout(() => {
    console.error(`\n❌ Timeout após ${TIMEOUT_MS / 1000}s sem receber callback.`)
    process.exit(1)
  }, TIMEOUT_MS)

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://127.0.0.1:${LOCAL_PORT}`)
    if (reqUrl.pathname !== callbackPath) {
      res.writeHead(404); res.end('not found'); return
    }

    const code = reqUrl.searchParams.get('code')
    const erro = reqUrl.searchParams.get('error')
    const returnedState = reqUrl.searchParams.get('state')

    if (erro || !code) {
      const msg = erro || 'code ausente no callback'
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(paginaErro(msg))
      console.error('❌ Callback com erro: ' + msg)
      clearTimeout(timeoutId); server.close(() => process.exit(1))
      return
    }
    if (returnedState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(paginaErro('state mismatch — possível CSRF, abortando'))
      console.error('❌ state mismatch')
      clearTimeout(timeoutId); server.close(() => process.exit(1))
      return
    }

    try {
      console.log(`📥 Code recebido (${code.length} chars). Trocando por tokens...`)
      const tokens = await trocarCodePorTokens(code)
      atualizarEnv({
        TIKTOK_ACCESS_TOKEN: tokens.access_token,
        TIKTOK_REFRESH_TOKEN: tokens.refresh_token,
        TIKTOK_OPEN_ID: tokens.open_id || '',
        TIKTOK_SCOPE: tokens.scope || SCOPE,
      })
      console.log(`✅ Tokens TikTok salvos no .env (escopo: ${tokens.scope || SCOPE})`)
      console.log(`   access_token expira em ${tokens.expires_in}s`)
      console.log(`   refresh_token válido por ${tokens.refresh_expires_in}s`)
      console.log(`   open_id: ${tokens.open_id}`)

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(paginaSucesso())
      clearTimeout(timeoutId); server.close(() => process.exit(0))
    } catch (err) {
      console.error('❌ ' + err.message)
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(paginaErro(err.message))
      clearTimeout(timeoutId); server.close(() => process.exit(1))
    }
  })

  server.listen(LOCAL_PORT, '127.0.0.1', () => {
    console.log(`📡 Servidor efêmero escutando em http://localhost:${LOCAL_PORT}${callbackPath}`)
    console.log(`   (o túnel HTTPS deve encaminhar pra esta porta)`)
    console.log('🌐 Abrindo browser...')
    abrirBrowser(authUrl)
    console.log(`⏳ Aguardando callback (timeout ${TIMEOUT_MS / 1000}s)...`)
  })
})()
