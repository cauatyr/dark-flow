#!/usr/bin/env node
require('dotenv').config()

const http = require('http')
const net = require('net')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { URL } = require('url')

const { trocarCodigoPorToken } = require('../api/youtube_api')

const PORT = 3000
const CALLBACK_PATH = '/oauth/youtube/callback'
const REDIRECT_URI = `http://localhost:${PORT}${CALLBACK_PATH}`
const ENV_PATH = path.join(__dirname, '..', '.env')
const TIMEOUT_MS = 5 * 60 * 1000

function construirAuthUrl() {
  if (!process.env.YOUTUBE_CLIENT_ID) {
    throw new Error('YOUTUBE_CLIENT_ID não configurado no .env')
  }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.YOUTUBE_CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

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
  if (platform === 'win32')  spawn('cmd',  ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
  else if (platform === 'darwin') spawn('open',  [url], { detached: true, stdio: 'ignore' }).unref()
  else                             spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
}

function atualizarEnv(refreshToken) {
  const original = fs.readFileSync(ENV_PATH, 'utf8')
  let atualizado
  if (/^YOUTUBE_REFRESH_TOKEN=.*$/m.test(original)) {
    atualizado = original.replace(/^YOUTUBE_REFRESH_TOKEN=.*$/m, `YOUTUBE_REFRESH_TOKEN=${refreshToken}`)
  } else {
    atualizado = original.trimEnd() + `\nYOUTUBE_REFRESH_TOKEN=${refreshToken}\n`
  }
  fs.writeFileSync(ENV_PATH, atualizado)
}

function paginaSucesso() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>YouTube OAuth OK</title>
<style>body{font-family:system-ui;background:#050505;color:#ede9e3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#0f0f0f;border:1px solid #e8213a;padding:40px;border-radius:8px;text-align:center}
h1{color:#e8213a;margin:0 0 16px}</style></head>
<body><div class="card"><h1>✅ Autorização concluída</h1><p>O refresh token foi salvo no <code>.env</code>.</p>
<p>Pode fechar essa aba e voltar para o terminal.</p></div></body></html>`
}

function paginaErro(msg) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>YouTube OAuth FAIL</title>
<style>body{font-family:system-ui;background:#050505;color:#ede9e3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#0f0f0f;border:1px solid #e8213a;padding:40px;border-radius:8px;text-align:center;max-width:600px}
h1{color:#e8213a;margin:0 0 16px}pre{background:#1a1a1a;padding:12px;border-radius:4px;text-align:left;overflow-x:auto}</style></head>
<body><div class="card"><h1>❌ Falhou</h1><pre>${msg}</pre></div></body></html>`
}

;(async () => {
  if (!await portaLivre(PORT)) {
    console.error(`❌ Porta ${PORT} ocupada. Pare o servidor DarkFlow antes de rodar este script.`)
    process.exit(1)
  }

  let authUrl
  try {
    authUrl = construirAuthUrl()
  } catch (e) {
    console.error('❌', e.message)
    process.exit(1)
  }

  console.log(`🎬 DarkFlow — YouTube OAuth\n`)
  console.log(`🔗 URL de autorização (confira os parâmetros antes):\n`)
  console.log(`   ${authUrl}\n`)
  const u = new URL(authUrl)
  console.log('   Parâmetros:')
  for (const [k, v] of u.searchParams) console.log(`     ${k} = ${v}`)
  console.log('')

  const timeoutId = setTimeout(() => {
    console.error(`\n❌ Timeout após ${TIMEOUT_MS / 1000}s sem receber callback. Encerrando.`)
    process.exit(1)
  }, TIMEOUT_MS)

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
    if (url.pathname !== CALLBACK_PATH) {
      res.writeHead(404); res.end('not found'); return
    }

    const code = url.searchParams.get('code')
    const erro = url.searchParams.get('error')
    if (erro || !code) {
      const msg = erro || 'code ausente no callback'
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(paginaErro(msg))
      console.error(`❌ Callback recebido com erro: ${msg}`)
      clearTimeout(timeoutId)
      server.close(() => process.exit(1))
      return
    }

    try {
      console.log(`📥 Code recebido (${code.length} chars). Trocando por tokens...`)
      const tokens = await trocarCodigoPorToken(code)

      if (!tokens.refresh_token) {
        throw new Error('Resposta veio sem refresh_token. Revogue o acesso em myaccount.google.com/permissions e tente de novo (precisa de prompt=consent para gerar refresh_token).')
      }

      atualizarEnv(tokens.refresh_token)
      console.log(`✅ YOUTUBE_REFRESH_TOKEN salvo no .env`)
      console.log(`   access_token expira em ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : '?'}`)
      console.log(`   scopes: ${tokens.scope || '?'}`)

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(paginaSucesso())
      clearTimeout(timeoutId)
      server.close(() => process.exit(0))
    } catch (err) {
      console.error('❌ Falha na troca do code:', err.message)
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(paginaErro(err.message))
      clearTimeout(timeoutId)
      server.close(() => process.exit(1))
    }
  })

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`📡 Servidor efêmero escutando em http://localhost:${PORT}${CALLBACK_PATH}`)
    console.log(`🌐 Abrindo browser para autorização (se não abrir, cole a URL acima)...`)
    abrirBrowser(authUrl)
    console.log(`⏳ Aguardando callback (timeout ${TIMEOUT_MS / 1000}s)...`)
  })
})()
