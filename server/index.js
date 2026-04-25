require('dotenv').config()

const express = require('express')
const http = require('http')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { WebSocketServer } = require('ws')

const session = require('./session')
const chat = require('./chat')

const PORT = process.env.PORT || 3000

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'frontend')))

app.get('/api/videos', (req, res) => {
  res.json(chat.listarVideosCriados())
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    sessoes: session.getAllSessions().length,
    timestamp: Date.now()
  })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const userId = crypto.randomBytes(8).toString('hex')
  session.createSession(userId, ws)

  ws.send(JSON.stringify({
    tipo: 'boas-vindas',
    userId,
    texto: '🎬 **DarkFlow Agent** online. Diga seu nome para começar, ou peça **/ajuda**.',
    autor: 'agente',
    timestamp: Date.now()
  }))

  ws.on('message', async (data) => {
    let msg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      ws.send(JSON.stringify({ tipo: 'erro', texto: 'Mensagem inválida.' }))
      return
    }

    if (msg.tipo === 'identificar') {
      session.setNome(userId, msg.nome || 'Usuário')
      ws.send(JSON.stringify({
        tipo: 'mensagem',
        autor: 'agente',
        texto: `Olá, **${msg.nome}**. Pronto para criar terror. Use **/gerar** ou peça **/ideias**.`,
        timestamp: Date.now()
      }))
      return
    }

    if (msg.tipo === 'mensagem') {
      ws.send(JSON.stringify({ tipo: 'digitando' }))

      const resposta = await chat.processar(userId, msg.texto, msg.nome)

      ws.send(JSON.stringify({
        tipo: 'mensagem',
        autor: 'agente',
        texto: resposta,
        timestamp: Date.now()
      }))
    }
  })

  ws.on('close', () => {
    session.removeSession(userId)
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message)
  })
})

server.listen(PORT, () => {
  console.log('')
  console.log('  🔴 \x1b[31mDARKFLOW AGENT\x1b[0m online')
  console.log(`  📡 http://localhost:${PORT}`)
  console.log('')

  const trilhaPath = path.join(__dirname, '..', 'audio', 'trilha-padrao.mp3')
  if (!fs.existsSync(trilhaPath)) {
    console.log('  ⚠️  trilha-padrao.mp3 ausente em audio/')
  }
  if (!process.env.DARKFLOW_REFRESH_TOKEN && !fs.existsSync(path.join(__dirname, '..', 'memory', '.refresh-token'))) {
    console.log('  ⚠️  Refresh token do DarkFlow não configurado')
  }
  console.log('')

  // Se houver cards com trabalho pendente, ativa monitor automaticamente no boot.
  // ativarMonitor() liga: cron 50min + Realtime watcher + check inicial.
  try {
    const monitor = require('../scripts/monitor-videos')
    const pendentes = chat.listarVideosCriados().filter(v => !v.postado && !v.dispensado)
    if (pendentes.length > 0) {
      console.log(`  🎬 ${pendentes.length} vídeo(s) pendente(s) — ativando monitor no boot`)
      monitor.ativarMonitor()
    } else {
      console.log('  📭 Nenhum vídeo pendente — monitor sobe quando criar o primeiro')
    }
  } catch (e) {
    console.log(`  ⚠️  Falha ao checar pendências no boot: ${e.message}`)
  }
  console.log('')
})

process.on('SIGINT', () => {
  console.log('\n🔴 Encerrando DarkFlow Agent...')
  server.close(() => process.exit(0))
})
