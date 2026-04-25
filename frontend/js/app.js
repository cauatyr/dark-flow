(function() {
  const $ = (sel) => document.querySelector(sel)
  const STORAGE_KEY = 'darkflow_nome'

  let ws = null
  let nomeUsuario = localStorage.getItem(STORAGE_KEY) || null

  // Elementos
  const modal           = $('#modal-login')
  const inputNome       = $('#input-nome')
  const btnEntrar       = $('#btn-entrar')
  const app             = $('#app')
  const statusDot       = $('#status-dot')
  const statusTexto     = $('#status-texto')
  const headerNome      = $('#header-nome')
  const mensagensEl     = $('#mensagens')
  const indicador       = $('#indicador-digitando')
  const inputMsg        = $('#input-mensagem')
  const btnEnviar       = $('#btn-enviar')
  const listaVideos     = $('#lista-videos')
  const videoDetalhe    = $('#video-detalhe')
  const btnVoltarDet    = $('#btn-voltar-detalhe')

  // ============ LOGIN ============
  function entrar() {
    const nome = inputNome.value.trim()
    if (!nome) return
    nomeUsuario = nome
    localStorage.setItem(STORAGE_KEY, nome)
    headerNome.textContent = nome
    modal.classList.add('hidden')
    app.classList.remove('hidden')
    conectar()
  }

  btnEntrar.addEventListener('click', entrar)
  inputNome.addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar() })

  if (nomeUsuario) {
    inputNome.value = nomeUsuario
    headerNome.textContent = nomeUsuario
    modal.classList.add('hidden')
    app.classList.remove('hidden')
    conectar()
  } else {
    inputNome.focus()
  }

  // ============ WEBSOCKET ============
  function conectar() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${proto}//${location.host}`)

    ws.onopen = () => {
      statusDot.classList.add('online')
      statusTexto.textContent = 'online'
      ws.send(JSON.stringify({ tipo: 'identificar', nome: nomeUsuario }))
      atualizarVideos()
    }

    ws.onclose = () => {
      statusDot.classList.remove('online')
      statusTexto.textContent = 'desconectado'
      setTimeout(conectar, 3000)
    }

    ws.onerror = () => {
      statusTexto.textContent = 'erro de conexão'
    }

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)

      if (msg.tipo === 'digitando') {
        indicador.classList.remove('hidden')
        btnEnviar.classList.add('loading')
        return
      }

      indicador.classList.add('hidden')
      btnEnviar.classList.remove('loading')

      if (msg.tipo === 'mensagem' || msg.tipo === 'boas-vindas') {
        adicionarMensagem(msg.autor || 'agente', msg.texto, msg.timestamp)
      }

      if (msg.tipo === 'notificacao-global') {
        adicionarMensagem('sistema', msg.texto, msg.timestamp)
        atualizarVideos()
        dispararHeartbeat()
      }

      if (msg.tipo === 'video-progresso') {
        atualizarProgressoVideo(msg.card_id, {
          progress: msg.progress,
          progress_message: msg.progress_message,
          status: msg.status,
        })
      }
    }
  }

  // ============ MENSAGENS ============
  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function formatarMarkdown(texto) {
    let t = escapeHtml(texto)
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
    return t
  }

  function adicionarMensagem(autor, texto, timestamp) {
    const div = document.createElement('div')
    div.className = `mensagem ${autor}`

    const avatar = document.createElement('div')
    if (autor === 'agente') {
      avatar.className = 'avatar avatar-agente'
      avatar.textContent = '🎬'
    } else if (autor === 'usuario') {
      avatar.className = 'avatar'
      avatar.textContent = (nomeUsuario || 'U').charAt(0).toUpperCase()
    } else {
      avatar.className = 'avatar'
      avatar.textContent = '⚙'
    }

    const conteudo = document.createElement('div')
    conteudo.className = 'mensagem-conteudo'
    conteudo.innerHTML = formatarMarkdown(texto)

    if (timestamp) {
      const ts = document.createElement('div')
      ts.className = 'timestamp'
      const d = new Date(timestamp)
      ts.textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      conteudo.appendChild(ts)
    }

    div.appendChild(avatar)
    div.appendChild(conteudo)
    mensagensEl.appendChild(div)
    mensagensEl.scrollTop = mensagensEl.scrollHeight

    // Blood particles nas mensagens do agente (após append pra getBoundingClientRect funcionar)
    if (autor === 'agente') {
      requestAnimationFrame(() => criarParticulasSangue(conteudo))
    }
  }

  // ============ HEARTBEAT — pulso vermelho + som 60Hz quando vídeo pronto ============
  function dispararHeartbeat() {
    const overlay = document.getElementById('heartbeat-overlay')
    if (!overlay) return
    overlay.style.animation = 'none'
    // force reflow pra reiniciar a animação se o pulso anterior ainda estava ativo
    void overlay.offsetHeight
    overlay.style.animation = 'heartbeat-pulse 2s ease forwards'

    // Som grave de batimento cardíaco — 60Hz com decay exponencial de 0.3s.
    // Browsers bloqueiam AudioContext até o 1º user gesture; try/catch engole
    // o erro no primeiro carregamento.
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 60
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }

  // ============ BLOOD PARTICLES ============
  function criarParticulasSangue(elemento) {
    const rect = elemento.getBoundingClientRect()
    const quantidade = Math.floor(Math.random() * 3) + 2  // 2-4 partículas

    for (let i = 0; i < quantidade; i++) {
      const particula = document.createElement('div')
      particula.style.cssText = `
        position: fixed;
        width: ${Math.random() * 3 + 1}px;
        height: ${Math.random() * 6 + 4}px;
        background: #e8213a;
        border-radius: 0 0 50% 50%;
        left: ${rect.left + Math.random() * rect.width}px;
        top: ${rect.top}px;
        pointer-events: none;
        z-index: 9999;
        opacity: 0.8;
        box-shadow: 0 0 4px rgba(232, 33, 58, 0.5);
      `
      document.body.appendChild(particula)

      particula.animate([
        { transform: 'translateY(0)', opacity: 0.8 },
        { transform: `translateY(${Math.random() * 40 + 20}px)`, opacity: 0 }
      ], {
        duration: Math.random() * 800 + 600,
        delay: Math.random() * 300,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      }).onfinish = () => particula.remove()
    }
  }

  // ============ ENVIO ============
  function enviar() {
    const texto = inputMsg.value.trim()
    if (!texto || !ws || ws.readyState !== 1) return
    adicionarMensagem('usuario', texto, Date.now())
    ws.send(JSON.stringify({ tipo: 'mensagem', texto, nome: nomeUsuario }))
    inputMsg.value = ''
    inputMsg.style.height = 'auto'
    btnEnviar.classList.add('loading')  // garantia: se 'digitando' não chegar, o mensagem final remove
  }

  btnEnviar.addEventListener('click', enviar)
  inputMsg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  })

  inputMsg.addEventListener('input', () => {
    inputMsg.style.height = 'auto'
    inputMsg.style.height = Math.min(inputMsg.scrollHeight, 120) + 'px'
  })

  // Botões de ação rápida
  document.querySelectorAll('.btn-acao').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd
      inputMsg.value = cmd
      enviar()
    })
  })

  // ============ LISTA DE VÍDEOS ============
  let listaExpandida = false
  const LIMITE_COLAPSADO = 5

  function statusDoVideo(v) {
    if (v.erro || v.has_error) return { cor: '🔴', label: 'erro', cls: 'erro' }
    if (v.pronto) return { cor: '🟢', label: 'concluído', cls: 'ok' }
    return { cor: '🟡', label: 'processando', cls: 'proc' }
  }

  function renderListaVideos(videos) {
    if (!videos || !videos.length) {
      listaVideos.innerHTML = '<div class="vazio">— nada na fila —</div>'
      return
    }
    const ordenados = [...videos].reverse()
    const visiveis = listaExpandida ? ordenados : ordenados.slice(0, LIMITE_COLAPSADO)
    const restante = ordenados.length - visiveis.length

    const itensHtml = visiveis.map(v => {
      const s = statusDoVideo(v)
      const titulo = (v.tema || 'sem título').slice(0, 30)
      const prog = (v.progress != null && v.progress > 0 && v.progress < 100)
        ? `<div class="video-progresso"><div class="video-progresso-barra" style="width:${v.progress}%"></div></div>`
        : ''
      const msgProg = v.progress_message
        ? `<div class="video-progresso-msg">${escapeHtml(v.progress_message)}${v.progress != null ? ` · ${v.progress}%` : ''}</div>`
        : ''
      return `<div class="video-item" data-id="${escapeHtml(v.id || '')}" data-status="${s.cls}">
        <span class="indicador" title="${s.label}">${s.cor}</span>
        <div class="video-meta">
          <span class="titulo" title="${escapeHtml(v.tema || '')}">${escapeHtml(titulo)}</span>
          ${msgProg}
          ${prog}
        </div>
      </div>`
    }).join('')

    const botaoHtml = restante > 0
      ? `<button class="btn-ver-todos" type="button">ver todos (+${restante})</button>`
      : (listaExpandida && ordenados.length > LIMITE_COLAPSADO
          ? `<button class="btn-ver-todos" type="button">recolher</button>`
          : '')

    listaVideos.innerHTML = itensHtml + botaoHtml

    const btn = listaVideos.querySelector('.btn-ver-todos')
    if (btn) {
      btn.addEventListener('click', () => {
        listaExpandida = !listaExpandida
        renderListaVideos(videosCacheados)
      })
    }

    // Handler de clique em cada vídeo — abre painel de detalhe
    listaVideos.querySelectorAll('.video-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id
        const video = videosCacheados.find(v => v.id === id)
        if (video) mostrarDetalheVideo(video)
      })
    })
  }

  // ============ DETALHE DO VÍDEO ============
  function formatarData(iso) {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch { return iso }
  }

  function mostrarDetalheVideo(video) {
    const s = statusDoVideo(video)
    const conteudo = videoDetalhe.querySelector('.detalhe-conteudo')
    const downloadHtml = video.download_url
      ? `<div class="detalhe-linha"><span class="rotulo">Download</span><span class="valor link"><a href="${escapeHtml(video.download_url)}" target="_blank" rel="noopener">${escapeHtml(video.download_url)}</a></span></div>`
      : `<div class="detalhe-linha"><span class="rotulo">Download</span><span class="valor" style="color: var(--muted)">— ainda não disponível —</span></div>`
    const progressoHtml = (video.progress != null && video.progress > 0 && video.progress < 100)
      ? `<div class="detalhe-progress-msg">${escapeHtml(video.progress_message || 'processando')} · ${video.progress}%</div>`
      : ''

    conteudo.innerHTML = `
      <div class="detalhe-titulo">${escapeHtml(video.tema || 'sem título')}</div>
      <div class="detalhe-id">card id: ${escapeHtml(video.id || '')}</div>
      <div class="detalhe-linha">
        <span class="rotulo">Status</span>
        <span class="valor">
          <span class="detalhe-status-pill ${s.cls}">${s.cor} ${s.label}</span>
        </span>
      </div>
      ${progressoHtml ? `<div class="detalhe-linha"><span class="rotulo">Progresso</span><span class="valor">${escapeHtml(video.progress_message || 'processando')} · ${video.progress}%</span></div>` : ''}
      <div class="detalhe-linha">
        <span class="rotulo">Duração</span>
        <span class="valor">${escapeHtml(video.duracao || '—')}</span>
      </div>
      <div class="detalhe-linha">
        <span class="rotulo">Criado em</span>
        <span class="valor">${escapeHtml(formatarData(video.criado_em))}</span>
      </div>
      ${downloadHtml}
    `
    videoDetalhe.classList.remove('hidden')
  }

  function voltarDoDetalhe() {
    videoDetalhe.classList.add('hidden')
  }

  if (btnVoltarDet) btnVoltarDet.addEventListener('click', voltarDoDetalhe)

  let videosCacheados = []

  async function atualizarVideos() {
    try {
      const r = await fetch('/api/videos')
      videosCacheados = await r.json()
      renderListaVideos(videosCacheados)
    } catch (e) {
      // silencioso
    }
  }

  function atualizarProgressoVideo(cardId, updates) {
    const idx = videosCacheados.findIndex(v => v.id === cardId)
    if (idx < 0) return
    videosCacheados[idx] = { ...videosCacheados[idx], ...updates }
    renderListaVideos(videosCacheados)
    // Se o painel de detalhe está aberto no mesmo card, re-renderiza
    if (videoDetalhe && !videoDetalhe.classList.contains('hidden')) {
      const conteudo = videoDetalhe.querySelector('.detalhe-conteudo')
      if (conteudo && conteudo.textContent.includes(cardId)) {
        mostrarDetalheVideo(videosCacheados[idx])
      }
    }
  }

  setInterval(atualizarVideos, 30000)

  // ============ SOM AMBIENTE ============
  // Só revela o botão se o arquivo frontend/audio/ambient.mp3 existir.
  // Enquanto o usuário não tiver providenciado o mp3, tudo fica invisível.
  const ambientAudio = document.getElementById('ambient-audio')
  const btnSom = document.getElementById('btn-som')
  const AMBIENT_KEY = 'darkflow_ambient'  // 'on' | 'off'
  const AMBIENT_VOL = 0.10                 // 10% padrão

  function setAmbientAtivo(ativo) {
    if (!ambientAudio || !btnSom) return
    if (ativo) {
      ambientAudio.volume = AMBIENT_VOL
      ambientAudio.play().catch(() => {})
      btnSom.textContent = '🔈'
      btnSom.classList.add('ativo')
      btnSom.title = 'som ambiente: ligado'
    } else {
      ambientAudio.pause()
      btnSom.textContent = '🔇'
      btnSom.classList.remove('ativo')
      btnSom.title = 'som ambiente: desligado'
    }
    localStorage.setItem(AMBIENT_KEY, ativo ? 'on' : 'off')
  }

  // Teste HEAD: só revela botão se o mp3 responder 200
  if (ambientAudio && btnSom) {
    fetch('audio/ambient.mp3', { method: 'HEAD' })
      .then(r => {
        if (!r.ok) return
        btnSom.classList.remove('hidden')
        const estado = localStorage.getItem(AMBIENT_KEY) || 'off'
        if (estado === 'on') {
          // Autoplay pode ser bloqueado; ouvinte de click-in-page aciona
          const ligar = () => { setAmbientAtivo(true); window.removeEventListener('click', ligar) }
          window.addEventListener('click', ligar, { once: true })
          btnSom.textContent = '🔈'
          btnSom.title = 'som ambiente: ligando no 1º clique'
        } else {
          setAmbientAtivo(false)
        }
        btnSom.addEventListener('click', () => {
          const ligado = !btnSom.classList.contains('ativo')
          setAmbientAtivo(ligado)
        })
      })
      .catch(() => { /* arquivo não existe — botão continua hidden */ })
  }

})();
