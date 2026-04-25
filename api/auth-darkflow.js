const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const SUPABASE_URL = 'https://ejansudxykwjwgnhdwma.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqYW5zdWR4eWt3andnbmhkd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNzExNjEsImV4cCI6MjA3MDk0NzE2MX0.3zEBlwiXNXEWOe-lw0eAMryHR0dTA78hz9P2Yf3hpWY'
const USER_ID = process.env.SUPABASE_USER_ID || '75fc8163-278f-4ff7-9a55-312e87bbafb3'

const CREDENTIALS_PATH = path.join(__dirname, '..', 'config', 'credentials.json')
const EMAIL = 'Rodrigodoracio@yahoo.com.br'
const PASSWORD = 'Digo@2312'
const LOGIN_URL = 'https://app.darkflow.io/'
const LOCALSTORAGE_KEY = 'sb-ejansudxykwjwgnhdwma-auth-token'

function lerCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) throw new Error('credentials.json não existe')
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'))
}

function salvarCredentials(data) {
  const dir = path.dirname(CREDENTIALS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(data, null, 2))
}

function decodeJwtPayload(token) {
  const parte = token.split('.')[1]
  if (!parte) throw new Error('JWT inválido')
  return JSON.parse(Buffer.from(parte, 'base64').toString())
}

async function renovarComRefreshToken(refreshToken) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    }
  )

  if (!response.ok) {
    console.log('⚠️  Refresh token inválido — fazendo login completo...')
    return await loginAutomatico()
  }

  const data = await response.json()

  salvarCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    updated_at: Date.now()
  })

  console.log('✅ Sessão renovada via refresh token')
  return data.access_token
}

async function loginAutomatico() {
  console.log('🔐 Fazendo login automático no DarkFlow...')
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()

    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('input[type="email"]', { timeout: 15000 })

    await page.click('input[type="email"]')
    await page.keyboard.press('Control+a')
    await page.evaluate(email => {
      document.execCommand('insertText', false, email)
    }, EMAIL)

    await page.click('button[type="submit"]')

    await page.waitForSelector('input[type="password"]', { timeout: 15000 })
    await page.click('input[type="password"]')
    await page.keyboard.press('Control+a')
    await page.evaluate(senha => {
      document.execCommand('insertText', false, senha)
    }, PASSWORD)

    await page.click('button[type="submit"]')

    await page.waitForFunction(
      key => {
        const raw = localStorage.getItem(key)
        if (!raw) return false
        try {
          const parsed = JSON.parse(raw)
          return Boolean(parsed && parsed.access_token && parsed.refresh_token)
        } catch {
          return false
        }
      },
      LOCALSTORAGE_KEY,
      { timeout: 20000 }
    )

    const rawToken = await page.evaluate(
      key => localStorage.getItem(key),
      LOCALSTORAGE_KEY
    )

    const tokenData = JSON.parse(rawToken)
    salvarCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      updated_at: Date.now()
    })

    console.log('✅ Login automático bem-sucedido')
    return tokenData.access_token
  } finally {
    await browser.close()
  }
}

async function getValidAccessToken() {
  try {
    const creds = lerCredentials()

    const payload = decodeJwtPayload(creds.access_token)
    const expirado = Date.now() / 1000 > payload.exp - 60

    if (!expirado) return creds.access_token

    return await renovarComRefreshToken(creds.refresh_token)
  } catch (e) {
    console.log(`⚠️  ${e.message} — fazendo login automático...`)
    return await loginAutomatico()
  }
}

function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    userId: USER_ID
  }
}

module.exports = {
  getValidAccessToken,
  getSupabaseConfig,
  loginAutomatico,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  USER_ID
}
