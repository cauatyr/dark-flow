#!/usr/bin/env node
// Spy do clique em "Gerar Vídeo" — abre browser visível, loga automático,
// captura TODAS as requests enquanto o usuário clica, e filtra o endpoint real.
// Uso: node scripts/spy-render-button.js

const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const { chromium } = require('playwright')
const { getValidAccessToken, getSupabaseConfig } = require('../api/auth-darkflow')

// Credenciais replicadas aqui porque auth-darkflow.js fecha o browser no fim
// do loginAutomatico e precisamos mantê-lo vivo pra capturar o clique.
const EMAIL = 'Rodrigodoracio@yahoo.com.br'
const PASSWORD = 'Digo@2312'
const LOGIN_URL = 'https://app.darkflow.io/'
const LOCALSTORAGE_KEY = 'sb-ejansudxykwjwgnhdwma-auth-token'
const DUMP_PATH = path.join(__dirname, '..', 'memory', 'spy-render-dump.json')
const JANELA_SEGUNDOS = 120

function hostFiltravel(url) {
  // retorna true se o host é supabase.co ou ejansudxykwjwgnhdwma (nossa instância)
  // — requests pra esses hosts NÃO são candidatos ao endpoint de render.
  return /supabase\.co/i.test(url) || /ejansudxykwjwgnhdwma/i.test(url)
}

async function findCardInGerarVideo() {
  const token = await getValidAccessToken()
  const { url, anonKey, userId } = getSupabaseConfig()
  const res = await fetch(url + '/rest/v1/video_cards?user_id=eq.' + userId + '&status=eq.gerar-video&order=created_at.desc&limit=1&select=id,theme,status,progress,progress_message', {
    headers: { 'Authorization': 'Bearer ' + token, 'apikey': anonKey }
  })
  const [c] = await res.json()
  if (!c) throw new Error('Nenhum card em status=gerar-video. Spy precisa de um card aguardando clique.')
  console.log(`🎯 Card alvo: ${c.id} | "${c.theme}"`)
  console.log(`   status=${c.status} | progress=${c.progress}% | msg="${c.progress_message || ''}"`)
  return c
}

async function loginNaPagina(page) {
  console.log('🔐 Navegando e autenticando...')
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.click('input[type="email"]')
  await page.keyboard.press('Control+a')
  await page.evaluate(e => document.execCommand('insertText', false, e), EMAIL)
  await page.click('button[type="submit"]')

  await page.waitForSelector('input[type="password"]', { timeout: 15000 })
  await page.click('input[type="password"]')
  await page.keyboard.press('Control+a')
  await page.evaluate(s => document.execCommand('insertText', false, s), PASSWORD)
  await page.click('button[type="submit"]')

  await page.waitForFunction(
    key => {
      const raw = localStorage.getItem(key)
      if (!raw) return false
      try {
        const p = JSON.parse(raw)
        return Boolean(p && p.access_token && p.refresh_token)
      } catch { return false }
    },
    LOCALSTORAGE_KEY,
    { timeout: 20000 }
  )
  console.log('✅ Logado')
}

async function main() {
  const card = await findCardInGerarVideo()

  const browser = await chromium.launch({ headless: false, slowMo: 50 })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Captura requests + responses desde o boot
  const requests = []
  const responses = new Map()

  page.on('request', req => {
    requests.push({
      ts: new Date().toISOString(),
      method: req.method(),
      url: req.url(),
      headers: req.headers(),
      postData: req.postData() || null,
      resourceType: req.resourceType()
    })
  })
  page.on('response', async res => {
    try {
      const req = res.request()
      const key = req.method() + ' ' + req.url()
      let body = null
      if (!/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|eot|css|mp3|mp4|webm|ico)(\?|$)/i.test(req.url())) {
        try { body = await res.text() } catch {}
        if (body && body.length > 4000) body = body.slice(0, 4000) + '…[truncated]'
      }
      responses.set(key, { status: res.status(), headers: res.headers(), body })
    } catch {}
  })

  await loginNaPagina(page)

  // Tenta abrir cada URL candidata e verifica se o botão "Gerar Vídeo" aparece
  const urlsCandidatas = [
    `https://app.darkflow.io/meus-videos`,
    `https://app.darkflow.io/dashboard`,
    `https://app.darkflow.io/`,
    `https://app.darkflow.io/video/${card.id}`,
    `https://app.darkflow.io/gerar-video/${card.id}`,
    `https://app.darkflow.io/videos/${card.id}`
  ]

  async function botaoGerarVideoVisivel() {
    const seletores = [
      'button:has-text("Gerar Vídeo")',
      'button:has-text("Gerar Video")',
      'button:has-text("GERAR VÍDEO")',
      '[role="button"]:has-text("Gerar Vídeo")'
    ]
    for (const sel of seletores) {
      try {
        if (await page.locator(sel).first().isVisible({ timeout: 1000 })) return sel
      } catch {}
    }
    return null
  }

  let urlEncontrada = null
  let seletorBotao = null
  for (const u of urlsCandidatas) {
    try {
      console.log('🌐 Tentando:', u)
      await page.goto(u, { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.log('  (goto err:', e.message.slice(0, 60), ')'))
      await page.waitForTimeout(1500)
      const seletor = await botaoGerarVideoVisivel()
      if (seletor) {
        urlEncontrada = u
        seletorBotao = seletor
        console.log('  ✅ botão "Gerar Vídeo" visível via:', seletor)
        break
      } else {
        console.log('  ⏭️  sem botão — próxima')
      }
    } catch (e) {
      console.log('  ❌', e.message.slice(0, 80))
    }
  }

  console.log()
  if (urlEncontrada) {
    console.log(`✅ Card encontrado em: ${urlEncontrada}`)
  } else {
    console.warn('⚠️  Nenhuma URL das candidatas tinha o botão "Gerar Vídeo" visível.')
    console.warn('   Navegue manualmente na aba aberta até o card.')
  }
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`🎬 CLIQUE EM GERAR VÍDEO AGORA — você tem ${JANELA_SEGUNDOS} segundos`)
  console.log(`   Card alvo: ${card.id.slice(0,8)} — "${card.theme}"`)
  console.log('═══════════════════════════════════════════════════════════')
  console.log()

  for (let s = JANELA_SEGUNDOS; s > 0; s -= 10) {
    console.log(`   ⏳ ${s}s restantes...`)
    await new Promise(r => setTimeout(r, 10_000))
  }

  await browser.close()

  // Junta requests + respostas
  const eventos = requests.map(r => {
    const key = r.method + ' ' + r.url
    return { ...r, response: responses.get(key) || null }
  })

  // Separa: fora-de-supabase é o que importa
  const foraDoSupabase = eventos.filter(e => !hostFiltravel(e.url))
  const candidatos = foraDoSupabase.filter(e => {
    const assets = ['image', 'stylesheet', 'font', 'media', 'manifest', 'other']
    return !assets.includes(e.resourceType)
  })

  // Dump completo
  fs.writeFileSync(DUMP_PATH, JSON.stringify({
    card_id: card.id,
    card_theme: card.theme,
    capturado_em: new Date().toISOString(),
    total_requests: eventos.length,
    fora_do_supabase_count: foraDoSupabase.length,
    candidatos_api_count: candidatos.length,
    fora_do_supabase: foraDoSupabase,
    candidatos_api: candidatos,
    eventos_completos: eventos
  }, null, 2))

  console.log()
  console.log('✅ Dump salvo em', DUMP_PATH)
  console.log('   Total eventos:', eventos.length)
  console.log('   Fora do Supabase:', foraDoSupabase.length)
  console.log('   Candidatos API :', candidatos.length)

  // DESTAQUE: hosts que NÃO são supabase.co / ejansudxykwjwgnhdwma
  console.log()
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🔴  CANDIDATOS AO ENDPOINT DE RENDER (hosts fora do Supabase)')
  console.log('═══════════════════════════════════════════════════════════════')
  if (candidatos.length === 0) {
    console.log()
    console.log('   (nenhuma request não-Supabase interceptada)')
    console.log('   ⚠️  Se você clicou em "Gerar Vídeo" durante a janela,')
    console.log('      o request pode ter ido pra um iframe ou service worker.')
    console.log('      Abra memory/spy-render-dump.json e olhe eventos_completos.')
  } else {
    for (const e of candidatos) {
      const status = e.response ? e.response.status : '?'
      console.log()
      console.log(`===== [${e.method}] ${e.url}`)
      console.log(`      status: ${status} | resourceType: ${e.resourceType} | ts: ${e.ts}`)
      if (e.postData) {
        const body = e.postData.length > 500 ? e.postData.slice(0, 500) + '…[truncated]' : e.postData
        console.log(`      body  : ${body}`)
      }
      if (e.response && e.response.body) {
        const resp = e.response.body.length > 300 ? e.response.body.slice(0, 300) + '…' : e.response.body
        console.log(`      resp  : ${resp}`)
      }
    }
  }
  console.log()
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('✅ Spy finalizado.')
}

main().catch(e => { console.error('FATAL:', e.message); if (e.stack) console.error(e.stack); process.exit(1) })
