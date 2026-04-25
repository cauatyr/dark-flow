require('dotenv').config()
const fetch = require('node-fetch')
const { createClient } = require('@supabase/supabase-js')
const { getValidAccessToken, getSupabaseConfig } = require('../api/auth-darkflow')
const { dispararRender } = require('../api/darkflow_api')

const STATUS_CONHECIDOS_PROCESSANDO = new Set([
  'videos-a-fazer', 'gerar-roteiro', 'gerar-narracao', 'concluido'
])
const STATUS_AGUARDANDO_CANDIDATOS = [
  'waiting', 'awaiting', 'aguardando', 'ready_to_render',
  'pending_render', 'gerar-video', 'aguardando-render', 'render-pronto'
]

async function main() {
  const token = await getValidAccessToken()
  const { url, anonKey, userId } = getSupabaseConfig()

  const cardArg = process.argv[2]
  let card
  if (cardArg) {
    const res = await fetch(
      `${url}/rest/v1/video_cards?id=eq.${cardArg}&user_id=eq.${userId}&select=id,theme,status,progress,progress_message,has_error,download_url`,
      { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } }
    )
    ;[card] = await res.json()
    if (!card) { console.error(`Card ${cardArg} não encontrado`); process.exit(1) }
  } else {
    const res = await fetch(
      `${url}/rest/v1/video_cards?user_id=eq.${userId}&order=created_at.desc&limit=1&select=id,theme,status,progress,progress_message,has_error,download_url`,
      { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } }
    )
    const rows = await res.json()
    card = rows[0]
    if (!card) { console.error('Nenhum card encontrado pro user'); process.exit(1) }
  }

  console.log('── Estado inicial ──')
  console.log('  id:              ', card.id)
  console.log('  theme:           ', card.theme)
  console.log('  status:          ', card.status)
  console.log('  progress:        ', card.progress + '%')
  console.log('  progress_message:', card.progress_message || '(vazio)')
  console.log('  download_url:    ', card.download_url ? 'presente' : 'null')
  console.log()

  const supabase = createClient(url, anonKey)
  supabase.realtime.setAuth(token)

  let jaDisparou = false

  const chan = supabase
    .channel(`card-${card.id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'video_cards', filter: `id=eq.${card.id}` },
      async (payload) => {
        const c = payload.new
        const t = new Date().toLocaleTimeString()
        console.log(`[${t}] status=${c.status} | progress=${c.progress}% | msg="${c.progress_message || ''}"`)
        if (c.has_error) console.log('  ⚠️  has_error:', c.has_error)
        if (c.error_logs) console.log('  error_logs:', JSON.stringify(c.error_logs).slice(0, 400))

        // Auto-disparo do render quando card chega no estado AGUARDANDO
        if (!jaDisparou && c.status === 'gerar-video' && c.progress === 100 && !c.progress_message) {
          jaDisparou = true
          console.log(`\n🎬 [${t}] Auto-render disparado para card ${c.id}`)
          try {
            await dispararRender(c.id)
            setTimeout(async () => {
              try {
                const check = await fetch(
                  `${url}/rest/v1/video_cards?id=eq.${c.id}&user_id=eq.${userId}&select=job_id,video_generation_triggered,progress,progress_message`,
                  { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } }
                )
                const rows = await check.json()
                const r = Array.isArray(rows) ? rows[0] : null
                if (r && r.job_id) {
                  console.log(`✅ Render confirmado — job_id: ${r.job_id}`)
                } else {
                  console.log(`⚠️  Render pode não ter disparado — verificar. State: job_id=${r && r.job_id} triggered=${r && r.video_generation_triggered} msg="${r && r.progress_message || ''}"`)
                }
              } catch (verr) {
                console.log(`⚠️  Erro verificando job_id:`, verr.message)
              }
            }, 5000)
          } catch (derr) {
            jaDisparou = false
            console.log(`❌ Erro ao disparar render:`, derr.message)
          }
        }

        const statusLower = (c.status || '').toLowerCase()
        const ehCandidato =
          STATUS_AGUARDANDO_CANDIDATOS.includes(statusLower) ||
          (!STATUS_CONHECIDOS_PROCESSANDO.has(c.status) && !c.download_url)

        if (ehCandidato && !jaDisparou) {
          console.log(`\n🚨 [${t}] CANDIDATO A "AGUARDANDO" DETECTADO`)
          console.log(`   status bruto: "${c.status}"`)
          console.log(`   audio chunks: ${c.completed_audio_parts}/${c.total_audio_chunks}`)
          console.log(`   image status: ${c.image_generation_status}`)
          console.log(`   download_url: ${c.download_url ? 'YES' : 'NO'}\n`)
        }

        if (c.download_url) {
          // Upload YouTube/TikTok + pendente-postagem.json REMOVIDOS em 2026-04-24.
          // monitor-card.js agora é só watchdog manual de diagnóstico — não
          // mais gera notificação pro chat (esse trabalho é do monitor-videos.js
          // via Realtime watcher + cron no mesmo processo do server).
          console.log(`\n✅ CONCLUÍDO! download_url: ${c.download_url}`)
          console.log(`   (notificação no chat já foi disparada pelo monitor-videos.js)`)
          process.exit(0)
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('👁️  Realtime SUBSCRIBED — aguardando mudanças (zero polling)...\n')
      } else if (err) {
        console.error('❌ Realtime erro:', err.message || err)
      } else {
        console.log('(realtime:', status + ')')
      }
    })

  const TIMEOUT_MIN = 60
  setTimeout(() => {
    console.log(`\n⏰ Timeout ${TIMEOUT_MIN}min — encerrando`)
    process.exit(0)
  }, TIMEOUT_MIN * 60 * 1000)

  process.on('SIGINT', async () => {
    console.log('\nEncerrando...')
    try { await supabase.removeChannel(chan) } catch {}
    process.exit(0)
  })
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1) })
