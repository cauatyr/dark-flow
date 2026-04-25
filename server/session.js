const sessions = new Map()

function createSession(userId, ws) {
  const session = {
    userId,
    ws,
    nome: 'Usuário',
    historico: [],
    pendente: null,
    createdAt: Date.now()
  }
  sessions.set(userId, session)
  return session
}

function getSession(userId) {
  return sessions.get(userId)
}

function setNome(userId, nome) {
  const s = sessions.get(userId)
  if (s) s.nome = nome
}

function appendHistorico(userId, role, content) {
  const s = sessions.get(userId)
  if (!s) return
  s.historico.push({ role, content })
  if (s.historico.length > 40) {
    s.historico = s.historico.slice(-40)
  }
}

function getHistorico(userId) {
  const s = sessions.get(userId)
  return s ? s.historico : []
}

function setPendente(userId, pendente) {
  const s = sessions.get(userId)
  if (s) s.pendente = pendente
}

function getPendente(userId) {
  const s = sessions.get(userId)
  return s ? s.pendente : null
}

function clearPendente(userId) {
  const s = sessions.get(userId)
  if (s) s.pendente = null
}

function removeSession(userId) {
  sessions.delete(userId)
}

function getAllSessions() {
  return Array.from(sessions.values())
}

function broadcast(message) {
  const payload = JSON.stringify(message)
  for (const session of sessions.values()) {
    if (session.ws && session.ws.readyState === 1) {
      session.ws.send(payload)
    }
  }
}

function sendTo(userId, message) {
  const s = sessions.get(userId)
  if (!s || !s.ws || s.ws.readyState !== 1) return false
  s.ws.send(JSON.stringify(message))
  return true
}

module.exports = {
  createSession,
  getSession,
  setNome,
  appendHistorico,
  getHistorico,
  setPendente,
  getPendente,
  clearPendente,
  removeSession,
  getAllSessions,
  broadcast,
  sendTo
}
