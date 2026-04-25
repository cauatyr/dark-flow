const fs = require('fs')
const path = require('path')
const cron = require('node-cron')

const VIDEOS_FILE = path.join(__dirname, '..', 'memory', 'videos-criados-por-mim.json')
const LOG_FILE = path.join(__dirname, '..', 'logs', 'monitor.log')

let cronJob = null
let darkflowApi = null
let sessionMod = null

// Realtime watcher (Opção A) + Set de cards já disparados (anti-duplicata entre Realtime e cron)
let realtimeClient = null
let realtimeChannel = null
const disparados = new Set()

function carregarDeps() {
  if (!darkflowApi) darkflowApi = require('../api/darkflow_api')
  if (!sessionMod) {
    try { sessionMod = require('../server/session') } catch { sessionMod = null }
  }
}

function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(LOG_FILE, linha)
  console.log(`[monitor] ${msg}`)
}

function listarVideos() {
  if (!fs.existsSync(VIDEOS_FILE)) return []
  try { return JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8')) } catch { return [] }
}

function salvarVideos(lista) {
  fs.writeFileSync(VIDEOS_FILE, JSON.stringify(lista, null, 2))
}

function atualizarVideo(id, mudancas) {
  const lista = listarVideos()
  const idx = lista.findIndex(v => v.id === id)
  if (idx >= 0) {
    lista[idx] = { ...lista[idx], ...mudancas }
    salvarVideos(lista)
  }
}

function notificarTodos(texto) {
  if (sessionMod && typeof sessionMod.broadcast === 'function') {
    sessionMod.broadcast({ tipo: 'notificacao-global', texto, timestamp: Date.now() })
  }
}

function ativarMonitor() {
  if (cronJob) {
    log('Monitor já está ativo')
    return
  }
  carregarDeps()
  cronJob = cron.schedule('*/50 * * * *', verificarVideos, { scheduled: true })
  log('✅ Monitor ATIVADO — verificando a cada 50 minutos')
  iniciarRealtimeWatcher()
}

function desativarMonitor() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    log('📭 Monitor DESATIVADO — fila vazia')
  }
  pararRealtimeWatcher()
}

async function iniciarRealtimeWatcher() {
  if (realtimeChannel) return
  carregarDeps()
  const { createClient } = require('@supabase/supabase-js')
  const { getValidAccessToken, getSupabaseConfig } = require('../api/auth-darkflow')

  try {
    const token = await getValidAccessToken()
    const { url, anonKey, userId } = getSupabaseConfig()
    realtimeClient = createClient(url, anonKey)
    realtimeClient.realtime.setAuth(token)

    realtimeChannel = realtimeClient
      .channel(`user-cards-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'video_cards', filter: `user_id=eq.${userId}` },
        async (payload) => {
          const c = payload.new
          const old = payload.old || {}

          // Broadcast de progresso pra frontend atualizar sidebar em tempo real.
          // Só dispara quando progress ou progress_message ou status mudam —
          // evita flood em updates triviais.
          const mudouProgresso = (c.progress !== old.progress) ||
                                 (c.progress_message !== old.progress_message) ||
                                 (c.status !== old.status) ||
                                 (c.has_error !== old.has_error)
          if (mudouProgresso && sessionMod && typeof sessionMod.broadcast === 'function') {
            sessionMod.broadcast({
              tipo: 'video-progresso',
              card_id: c.id,
              progress: c.progress,
              progress_message: c.progress_message,
              status: c.status,
              has_error: c.has_error || false,
              timestamp: Date.now(),
            })
          }

          // Detecta conclusão → notifica chat pra user baixar manualmente pelo DarkFlow.
          if (c.status === 'concluido' && c.download_url && !disparados.has('post:' + c.id)) {
            disparados.add('post:' + c.id)
            try {
              atualizarVideo(c.id, { pronto: true, download_url: c.download_url })
              notificarTodos(`✅ **${c.theme}** está pronto!\n🎬 Acesse o DarkFlow para baixar e publicar.`)
              log(`🔔 [Realtime] notificado: ${c.id} (${c.theme})`)
            } catch (e) { log(`⚠️ falha notificando: ${e.message}`) }
          }
          if (c.status === 'gerar-video' && c.progress === 100 && !c.progress_message && !disparados.has(c.id)) {
            disparados.add(c.id)
            log(`🎬 [Realtime] Auto-render detectado em ${c.id} — disparando`)
            try {
              await darkflowApi.dispararRender(c.id)
              log(`✅ [Realtime] Render disparado em ${c.id}`)
            } catch (err) {
              log(`❌ [Realtime] Falha: ${err.message}`)
              disparados.delete(c.id)
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          log('👁️  Realtime watcher SUBSCRIBED (auto-render)')
          // Check inicial: pode haver card em gerar-video progress=100 que já estava parado
          // antes do server subir — Realtime só captura UPDATEs futuros, não estado atual
          setImmediate(() => verificarVideos().catch(e => log(`⚠️ check inicial falhou: ${e.message}`)))
        } else if (err) {
          log(`❌ Realtime erro: ${err.message || err}`)
        } else {
          log(`(realtime: ${status})`)
        }
      })
  } catch (e) {
    log(`❌ Falha iniciando Realtime watcher: ${e.message}`)
  }
}

async function pararRealtimeWatcher() {
  if (realtimeChannel) {
    try { await realtimeClient.removeChannel(realtimeChannel) } catch {}
    realtimeChannel = null
    realtimeClient = null
    log('📴 Realtime watcher desativado')
  }
}

function statusMonitor() {
  return cronJob !== null
}

async function verificarVideos() {
  carregarDeps()
  const videos = listarVideos()
  const pendentes = videos.filter(v => !v.postado)

  if (pendentes.length === 0) {
    log('Nenhum vídeo pendente')
    desativarMonitor()
    return
  }

  log(`Verificando ${pendentes.length} vídeos pendentes`)

  for (const video of pendentes) {
    try {
      const card = await darkflowApi.checarStatusCard(video.id)
      if (!card) {
        log(`⚠️ ${video.id} não encontrado`)
        continue
      }

      const status = card.status
      log(`${video.tema || video.id}: ${status}`)

      // Fallback cron (Opção C): detecta AGUARDANDO e dispara render se Realtime perdeu
      if (status === 'gerar-video' && card.progress === 100 && !card.progress_message && !disparados.has(video.id)) {
        disparados.add(video.id)
        log(`🎬 [Cron] Auto-render detectado em ${video.id} — disparando (fallback)`)
        try {
          await darkflowApi.dispararRender(video.id)
          log(`✅ [Cron] Render disparado em ${video.id}`)
        } catch (err) {
          log(`❌ [Cron] Falha: ${err.message}`)
          disparados.delete(video.id)
        }
      }

      if (status === 'concluido' && card.download_url) {
        if (!video.pronto) {
          atualizarVideo(video.id, { pronto: true, download_url: card.download_url })
        }
        // Upload YouTube/TikTok REMOVIDO em 2026-04-24. Só notifica uma vez por card.
        if (!video.notificado) {
          atualizarVideo(video.id, { notificado: true })
          notificarTodos(`✅ **${video.tema}** está pronto!\n🎬 Acesse o DarkFlow para baixar e publicar.`)
          log(`🔔 [Cron] notificado: ${video.id}`)
        }
      }
    } catch (err) {
      log(`❌ Erro ao verificar ${video.id}: ${err.message}`)
    }
  }
}

if (require.main === module) {
  console.log('🔴 Monitor DarkFlow iniciando manualmente...')
  ativarMonitor()
  verificarVideos()
}

module.exports = {
  ativarMonitor,
  desativarMonitor,
  statusMonitor,
  verificarVideos,
  iniciarRealtimeWatcher,
  pararRealtimeWatcher
}
