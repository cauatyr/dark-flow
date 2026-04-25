const { chromium } = require('playwright')
const { getValidAccessToken } = require('../api/auth-darkflow')

const LOCALSTORAGE_KEY = 'sb-ejansudxykwjwgnhdwma-auth-token'

function interessante(url, body) {
  const lower = url.toLowerCase()
  if (lower.includes('/tts') || lower.includes('voice') || lower.includes('narrac') || lower.includes('speaker')) return true
  if (typeof body === 'string' && /voice|tts|narracao/i.test(body)) return true
  return false
}

;(async () => {
  const token = await getValidAccessToken()
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  let capturas = 0

  page.on('request', request => {
    const url = request.url()
    const body = request.postData()
    if (!interessante(url, body)) return

    capturas++
    console.log(`\n━━━━━━━━━━━━━━ REQUISIÇÃO #${capturas} ━━━━━━━━━━━━━━`)
    console.log('🔹 URL   :', url)
    console.log('🔹 METHOD:', request.method())
    if (body) {
      console.log('🔹 BODY  :')
      try {
        console.log(JSON.stringify(JSON.parse(body), null, 2))
      } catch {
        console.log(body)
      }
    }
    const h = request.headers()
    const hFiltrados = {}
    for (const k of ['authorization', 'apikey', 'content-type', 'x-client-info', 'referer', 'origin']) {
      if (h[k]) hFiltrados[k] = k === 'authorization' ? h[k].slice(0, 30) + '…' : h[k]
    }
    console.log('🔹 HEADERS:', JSON.stringify(hFiltrados, null, 2))
  })

  page.on('response', async response => {
    const url = response.url()
    if (!interessante(url, null)) return
    try {
      const ct = response.headers()['content-type'] || ''
      if (!ct.includes('json')) return
      const body = await response.json()
      const preview = JSON.stringify(body)
      if (preview.length > 1500) {
        console.log(`\n📦 RESPOSTA [${response.status()}] ${url}`)
        console.log('    (truncado:', preview.length, 'chars) primeiros 1500:')
        console.log(preview.slice(0, 1500) + '…')
      } else {
        console.log(`\n📦 RESPOSTA [${response.status()}] ${url}`)
        console.log(preview)
      }
    } catch {}
  })

  await page.goto('https://app.darkflow.io/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ t, key }) => {
    const auth = JSON.parse(localStorage.getItem(key) || '{}')
    auth.access_token = t
    localStorage.setItem(key, JSON.stringify(auth))
  }, { t: token, key: LOCALSTORAGE_KEY })

  await page.reload({ waitUntil: 'networkidle' })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎬 DarkFlow spy-tts ativo. Browser aberto.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👉 Navegue manualmente para "Criar Vídeo" e crie 1 vídeo')
  console.log('   escolhendo uma voz qualquer (ex: Matheus, Paula, etc).')
  console.log('👉 Qualquer chamada que mencione voice/tts será capturada aqui.')
  console.log('   (Ctrl+C ou TaskStop quando terminar a coleta)')
  console.log('')

  await new Promise(() => {})
})().catch(e => {
  console.error('❌ ERRO:', e.message)
  console.error(e.stack)
  process.exit(1)
})
