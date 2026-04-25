# DARKFLOW AGENT — MEMÓRIA DE SESSÃO
Data: 2026-04-24 (sessão noite — frontend redesign + animações de impacto)

## ⭐⭐⭐ ESTADO NO FIM DE 2026-04-24 (NOITE) — LEIA ISSO PRIMEIRO AO RETOMAR

### Resumo executivo
Sessão longa de frontend, dividida em **3 fases**: (1) 8 melhorias UX aplicadas e mantidas, (2) 10 mudanças "impacto cinematográfico" aplicadas e majoritariamente revertidas (só sobreviveu o placeholder novo), (3) 4 animações de impacto + cleanup de strings hardcoded mencionando upload. Ao final há painel de detalhe ao clicar em vídeo da sidebar e o flow ficou completamente limpo de menções a YouTube/TikTok.

### ✅ Frontend — features mantidas (estado final)

#### Pasta `frontend/`
- `index.html` — modal login + app + chat + sidebar + 2 overlays globais (intro, heartbeat) + audio escondido
- `css/style.css` (~1100 linhas) — paleta `#050505/#e8213a/#ede9e3`, fontes Anton/Crimson Pro/JetBrains Mono
- `js/app.js` (~330 linhas) — WebSocket, render mensagens, sidebar, detalhe vídeo, blood particles, heartbeat, som ambiente

#### Lista do que está ativo no UI
1. **Grain global** — `body::after` com SVG noise opacity 0.035 + animation `grain-drift` 8s steps(4). Atmosfera de película 16mm.
2. **Glitch logo DARKFLOW** — `data-text="DARKFLOW"` no `.logo` + `::before` ciano + `::after` vermelho com `animation: logo-glitch 10s infinite` (200ms a cada ciclo). Apenas no header (não no modal de login).
3. **Borda vermelha sangramento** — `.mensagem.agente .mensagem-conteudo::before` width 2px com gradient vertical `var(--red)` → transparente.
4. **Sidebar status 🟢🟡🔴** — `statusDoVideo()` em app.js mapeia: `pronto:true` → 🟢 concluído, `has_error/erro:true` → 🔴 erro, default → 🟡 processando. `title=` HTML como tooltip nativo. Glow colorido por status via `filter: drop-shadow`.
5. **Legenda no rodapé sidebar** — `<div class="sidebar-legenda">` flex-column `margin-top:auto`, JetBrains Mono 10px.
6. **Sidebar — últimos 5 + ver todos** — `LIMITE_COLAPSADO=5`, `listaExpandida` flag, botão `.btn-ver-todos` "ver todos (+N)" alterna pra "recolher". Scroll do container preserva.
7. **Botão enviar ⚡** — ícone raio (era `→`); `box-shadow` pulso vermelho no hover (`@keyframes btn-pulse`); spinner branco quando `.loading` (adicionado em `enviar()` e removido em `ws.onmessage`).
8. **Som ambiente infra** — `<audio id="ambient-audio" src="audio/ambient.mp3" loop preload="none">`; `<button id="btn-som" class="btn-som hidden">` no header. JS faz `fetch HEAD` no mp3 — só revela botão se 200. Volume 10%, persistido em `localStorage.darkflow_ambient`. Funciona apenas após user soltar `frontend/audio/ambient.mp3`.
9. **Progresso tempo real** — `monitor-videos.js` Realtime watcher compara `payload.old` vs `payload.new` e broadcast `tipo:'video-progresso'` quando muda progress/progress_message/status/has_error. Frontend `atualizarProgressoVideo(cardId, updates)` re-renderiza item da sidebar com barra fina vermelha + msg "Gerando narração... 45%".
10. **Painel de detalhe ao clicar em vídeo** — click em `.video-item` mostra `#video-detalhe` que toma a área das mensagens. Conteúdo: título Anton 32px + card ID Mono + status pill + progresso (se ativo) + duração + criado em pt-BR + download_url como link `target="_blank"` (ou placeholder "ainda não disponível"). Botão `← voltar` no topo-esquerdo. Auto-atualiza se `video-progresso` chegar enquanto aberto.
11. **Placeholder do input** — `"— o que você quer que o mundo tema..."` (era `"— diga o que criar..."`). Único sobrevivente da fase de "impacto cinematográfico".

#### 4 animações de impacto (último round, mantidas)
12. **Blood particles** — `criarParticulasSangue(.mensagem-conteudo)` chamada via `requestAnimationFrame` ao adicionar mensagem com `autor === 'agente'`. 2-4 partículas `position:fixed` (1-4px × 4-10px, gradient bottom-rounded), animadas via `Element.animate()` API (Web Animations) com translate-Y aleatório + fade out + delay aleatório, easing `cubic-bezier(0.25, 0.46, 0.45, 0.94)`. `box-shadow: 0 0 4px var(--red-glow)`. Auto-remove no `onfinish`.
13. **Sidebar hover reveal** — `@keyframes hover-reveal` em `.video-item:hover .titulo`. 5 stops (blur+brightness, branco, blur+translateX, vermelho intermediário, glow vermelho final). 0.4s `forwards`. **`.titulo` precisa ser `display: inline-block`** pra `transform: translateX` funcionar (elementos inline ignoram).
14. **Intro overlay** — `<div id="intro-overlay">` z-index **99999**, fundo preto, centro com cursor 2×24px vermelho piscando (`@keyframes cursor-blink` 0.6s) + glow 8px. Script no fim do HTML: `window.load` → setTimeout 1.2s → `opacity:0` com `transition 0.8s` → `remove()` após 800ms. Total: ~2s de boot. Aparece em todo refresh, inclusive em localhost (decisão explícita do user).
15. **Heartbeat pulse + áudio 60Hz** — `<div id="heartbeat-overlay">` z-index 99998. `@keyframes heartbeat-pulse` 2s com 2 picos (15% e 45%, border 0→3px, inset shadow 60-80px vermelho). `dispararHeartbeat()` força reflow (`void overlay.offsetHeight`) antes de reaplicar animation. `AudioContext` 60Hz com decay exponencial 0.3s; try/catch engole bloqueio de autoplay no 1º load (funciona após user gesture). Chamado dentro do handler `notificacao-global` no `ws.onmessage`.

### ❌ Coisas que tentamos e descartamos (fase 2 — "impacto cinematográfico")
User chamou de "piorou muito" e mandou reverter. **NÃO REINTRODUZIR**:
- Fundo radial-gradient global (`#0d0d0d → #020202`) e vignette `body::before`
- Sidebar com border-right vermelho 2px + box-shadow lateral 24px
- `.sidebar::after` "blood drip" descendo top→bottom em 7s
- `.secao-label` letter-spacing 0.2em opacity 0.5 (volta pra original 3px / `#3a3a3a`)
- Hover dos títulos com text-shadow 8px (volta pra mudança simples de cor)
- `.mensagem.agente .mensagem-conteudo` com `background: rgba(232,33,58,0.03)` + `box-shadow: -3px 0 12px rgba(232,33,58,0.15)` (mantém só borda esquerda 2px)
- Borda da mensagem agente em **3px** (volta pra **2px**)
- Logo `FLOW` text-shadow em 3 camadas
- Input focus com box-shadow ring + halo 20px
- Botão enviar com box-shadow permanente 15px (mantém só pulse no hover)
- Scrollbar 4px vermelha translúcida (volta pra 2px `#1e1e1e`)
- Animação de mensagem entrando com `filter: blur(3px)` (volta pra fade+translate 0.25s simples)
- Olho SVG perturbador piscando + texto "processando nas trevas" (volta pros 3 traços `.typing-bar`)

### ✅ Backend — strings hardcoded limpas (3 diffs em `server/chat.js`)
- **`SYSTEM_PROMPT`** linha 31: `"...vídeos no YouTube e TikTok"` → `"...shorts verticais (formato TikTok/Reels/Shorts) e vídeos longos"` (sem alusão a upload).
- **Mensagem de confirmação após `criarVideoNaAPI`** linha 486: era `"O monitor de 50 minutos foi ativado. Você será notificado quando o vídeo estiver pronto e postado no YouTube + TikTok."` → agora `"O monitor foi ativado. Você será notificado aqui quando o vídeo estiver pronto para baixar no DarkFlow."`
- **`statusVideos()`** linha 496: usava `v.postado ? '✅ postado' : (v.pronto ? '🎬 pronto' : '⏳ processando')` → agora `v.pronto ? '🟢 pronto' : '🟡 processando'` (coerente com legenda da sidebar).

### Stack de z-index final
| Camada | z-index | Notas |
|---|---|---|
| `#intro-overlay` | 99999 | preto + cursor; remove do DOM após fade |
| `#heartbeat-overlay` | 99998 | pulse + áudio na chegada de notificacao-global |
| `body::after` (grain) | 9999 | mix-blend-mode overlay |
| Blood particles | 9999 | empate com grain mas DOM-order ganha (são depois) |
| `#video-detalhe` | 5 | painel ocupa área de mensagens |
| `.modal-overlay` (login) | 100 | só aparece se localStorage vazio |

### Arquivos alterados nesta sessão (noite 2026-04-24)
- `server/chat.js` — 3 string-cleanups (SYSTEM_PROMPT, mensagem pós-criação, statusVideos)
- `frontend/index.html` — `data-text="DARKFLOW"` no logo, sidebar-legenda, btn-som, audio tag, 2 overlays (intro + heartbeat), painel video-detalhe, typing-bar (revertido pra 3 traços)
- `frontend/css/style.css` — adicionados/mantidos: grain, glitch logo, borda vermelha 2px msgs agente, sidebar legend, btn-ver-todos, video-detalhe completo, btn enviar pulse, sidebar hover reveal keyframe, intro overlay + cursor blink, heartbeat overlay + pulse keyframe. Revertidos da fase 2 (lista acima).
- `frontend/js/app.js` — `statusDoVideo()`, `renderListaVideos()` com expansão, `mostrarDetalheVideo()`, `voltarDoDetalhe()`, `criarParticulasSangue()`, `dispararHeartbeat()`, handler `notificacao-global` chama heartbeat, handler `video-progresso`, infra de som ambiente com fetch HEAD.
- `scripts/monitor-videos.js` — broadcast `tipo:'video-progresso'` quando `payload.old` ≠ `payload.new` em campos relevantes (progress, progress_message, status, has_error).
- `frontend/audio/` — pasta criada vazia; mp3 fica pendente do user.

### Como retomar
```
cd C:\Users\Pichau\darkflow-agent
node server/index.js
```
`Ctrl+Shift+R` no browser pra limpar cache. Intro overlay vai aparecer 1.2s + fade 0.8s antes do app.

### Pendências carregadas (sem urgência)
1. **Som ambiente** — user vai providenciar `frontend/audio/ambient.mp3` (loop de vento/estática). Botão aparece sozinho via fetch HEAD após o arquivo existir.
2. **Submissão TikTok (Opção C Render)** — agora menos urgente, já que upload foi removido. Os intercepts `verificar tiktok`/`posta direto` continuam funcionais.
3. **Histórico de conversa por vídeo** (item 9 que ficou faseado) — clicar em vídeo mostraria mensagens relacionadas àquele card. Atual painel mostra só metadados. Implementação requer associar `card_id` a mensagens em `session.js`.
4. **Housekeeping** dos 5 cards purgados em `videos-criados-por-mim.json`.
5. `@anthropic-ai/sdk` órfão no `package.json` — ainda não removido.

---

## ⭐⭐ ESTADO NO FIM DE 2026-04-24 (TARDE) — LEIA ISSO PRIMEIRO AO RETOMAR

### Decisão do dia: upload YouTube + TikTok REMOVIDO
User decidiu que o sistema **não posta em lugar nenhum automaticamente**. Quando o vídeo conclui, só notifica no chat e user baixa/posta manualmente pelo DarkFlow. Projeto em pausa após essa mudança.

### Fluxo atual (pós-remoção)
1. User pede vídeo → chat cria card via API DarkFlow (mesma lógica de antes — `criarVideo()`, voz, bucket, `subtitle_settings`, etc).
2. Card progride no DarkFlow: `videos-a-fazer → gerar-roteiro → gerar-narracao → gerar-imagens → gerar-video → concluido`.
3. Em `gerar-video` com `progress=100 && !progress_message`, `dispararRender()` automático (Realtime watcher + cron fallback).
4. Quando status vira `concluido + download_url`:
   - Marca `pronto:true, notificado:true` em `memory/videos-criados-por-mim.json`
   - Broadcast WebSocket: **"✅ **[título]** está pronto! 🎬 Acesse o DarkFlow para baixar e publicar."**
   - **FIM do flow automático.** User baixa o mp4 diretamente no DarkFlow e posta onde quiser.

### Código removido nesta sessão
- **`scripts/monitor-videos.js`**:
  - Funções: `processarVideoConcluido` inteira (~65 linhas de upload YouTube + TikTok)
  - Imports: `youtube_api`, `tiktok_api` (do carregarDeps)
  - Constante `DOWNLOADS_DIR`
  - Blocos Realtime e cron que escreviam `pendente-postagem.json` — substituídos por chamada direta `notificarTodos()`
  - Export de `processarVideoConcluido`
- **`server/chat.js`**:
  - Funções: `lerPendentePostagem`, `limparPendentePostagem`, `iniciarWatcherPostagem`, `detectarAprovacaoPostagem`, `detectarRejeicaoPostagem`, `parseComandoPostarManual`, `processarAprovacaoPostagem`
  - Intercept 1 (postar manual `posta <título>`) em `processarComando`
  - Intercept 2 (aprovação/rejeição de postagem pendente) em `processarComando`
  - Chamada `iniciarWatcherPostagem()` no `processar`
  - Constante `PENDENTE_POSTAGEM_PATH`
  - Flag variável `watcherPostagemIniciado`
- **`scripts/monitor-card.js`**:
  - Bloco que escrevia `pendente-postagem.json` quando detectava `download_url` (substituído por log console informativo)

### Código preservado (intencional)
- **`api/tiktok_api.js`** intacto — os intercepts de chat `verificar tiktok` (0b) e `posta direto` (0a) continuam usando `buscarInfoContaTikTok()` e `testarDirectPost()`. Essas chamadas são **diagnóstico**, não upload — úteis pro fluxo de submissão TikTok quando for retomado.
- `uploadTikTok()` e `uploadYoutube()` dentro dos módulos ficam sem chamador, mas não remove.

### Arquivos órfãos (decisão: manter no repo, não deletar)
- `api/youtube_api.js` — nada importa
- `scripts/upload-youtube.js`, `scripts/upload-tiktok.js` — utilitários manuais (podem ser úteis depois)
- `scripts/youtube-oauth.js`, `scripts/tiktok-oauth.js` — helpers de reprovisionamento OAuth

### Flags legado em `videos-criados-por-mim.json`
Campos **ignorados pelo código atual** mas ainda presentes em cards antigos:
- `dispensado` — era "user rejeitou postar" (flow removido)
- `aguardar_confirmacao` — era marcador de "aguardando user aprovar post" (flow removido)
- `postado`, `youtube_link`, `tiktok_inbox`, `tiktok_sandbox`, `postado_em` — vestígios do upload antigo

Novo campo em uso: `notificado: true` (evita re-aviso pelo cron após primeira notificação).

### Pendências carregadas
1. **Submissão TikTok (Opção C Render)** — planejada mas agora **sem urgência** já que não vamos mais fazer upload automático. Os intercepts `verificar tiktok` e `posta direto` continuam úteis caso queira submeter no futuro.
2. **Housekeeping** dos 5 cards purgados em `videos-criados-por-mim.json` — continua pendente, baixa prioridade.
3. `memory/pendente-postagem.json` no disco — se existir, pode apagar (não é mais usado).
4. `@anthropic-ai/sdk` órfão no `package.json` — ainda não removido.

### Como retomar o servidor
```
cd C:\Users\Pichau\darkflow-agent
node server/index.js
```
Se porta ocupada: `powershell -Command "Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`.

### Arquivos alterados nesta sessão
- `scripts/monitor-videos.js` — removidas imports + processarVideoConcluido + blocos pendente; notificação direta
- `server/chat.js` — removidos todos os artefatos do flow de postagem; intercepts TikTok diagnósticos preservados
- `scripts/monitor-card.js` — limpo bloco de pendente-postagem (arquivo mantido como watchdog)
- `memory/CHATBOT-REGRAS.md` — substituída seção de Postagem e TikTok upload por nota de remoção + intercepts preservados
- `memory/CRITICAL-DARKFLOW-AUTOMATION.md` — substituída seção Postagem por regra absoluta "não reintroduzir upload"
- `memory/SESSAO-ATUAL.md` — este bloco

---

## ⭐ ESTADO NO FIM DE 2026-04-24 (MANHÃ) — LEIA ISSO PRIMEIRO AO RETOMAR

### Resumo executivo
Sessão curta focada em preparar a **demonstração TikTok pra submissão do app** (objetivo: desbloquear o escopo `video.publish`). Implementamos dois intercepts de diagnóstico no chat (status real da conta + teste do escopo `video.publish`) e **aplicamos os 3 diffs do Opção B do polling que tinham ficado pendentes de 2026-04-23**. Identificamos bloqueador na submissão: o `redirect_uri` atual (`https://www.google.com`) é um workaround e não será aceito pela revisão do TikTok Developer. Decisão: subir mini-servidor no Render como "vitrine" + callback permanente (Opção C).

### ✅ O que foi aplicado nesta sessão

#### 1. Intercepts de diagnóstico TikTok no chat
- **`api/tiktok_api.js`** ganhou duas funções exportadas:
  - `testarDirectPost()` → `POST /v2/post/publish/video/init/` com payload `post_info` + `source_info` mínimo. Retorna o JSON bruto da API — provavelmente `scope_not_authorized` ou `unaudited_client_can_only_post_to_private_accounts` enquanto o app não for auditado.
  - `buscarInfoContaTikTok()` → `GET /v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username`. Retorna dados reais da conta conectada pelo token atual.
- **`server/chat.js`** ganhou:
  - Import `const tiktok = require('../api/tiktok_api')`.
  - Detectores `detectarDirectPost` (frases: `posta direto`, `publica direto`, `video.publish`, `direct post`, `publicar direto`, `postar direto`) e `detectarStatusTikTok` (frases: `conectar tiktok`, `status tiktok`, `tiktok conectado`, `minha conta tiktok`, `info tiktok`, `verificar tiktok`). Match por `.includes()`, não exato.
  - **Intercept 0a** no topo de `processarComando` → Direct Post: chama `testarDirectPost()`, extrai `error.code` + `error.message`, responde "📱 Direct Post TikTok — integração implementada. A API retornou: [erro]. Este escopo ficará ativo após aprovação do app pelo TikTok. O fluxo técnico está completo e funcional."
  - **Intercept 0b** → Status TikTok: chama `buscarInfoContaTikTok()`, extrai `data.user`, responde "✅ TikTok conectado!" + Nome/Username/Open ID + escopos ativos + linha `⏳ video.publish: aguardando aprovação do app`.
- **Ordem crítica:** 0a e 0b vêm ANTES de `parseComandoPostarManual` — senão "posta direto" casaria com o regex `/^posta\s+(.+)/` e tentaria achar um vídeo chamado "direto".

#### 2. Opção B do TikTok polling — APLICADO (não estava pendente mais)
Os 3 diffs que ficaram abertos em 2026-04-23 foram aplicados nesta sessão:
- **`api/tiktok_api.js` — polling loop**: adicionado check `if (s === 'PROCESSING_UPLOAD' && uploadedBytes === videoSize) { statusFinal = 'UPLOADED_PROCESSING'; break }`. Sucesso antecipado quando todos os bytes chegaram.
- **`api/tiktok_api.js` — retorno de `uploadTikTok`**: `mensagem` trocada pra `"✅ TikTok: vídeo enviado com sucesso — abra o app TikTok na aba Notificações para revisar e publicar"`. Campo `status` agora é `'inbox'` ou `'uploaded_processing'` conforme o estado terminal alcançado.
- **`scripts/monitor-videos.js`**: linha da mensagem final TikTok trocada pro mesmo texto.

Regra já estava documentada em `CHATBOT-REGRAS.md` (linhas 29-33) e `CRITICAL-DARKFLOW-AUTOMATION.md` (linha 78) desde 2026-04-23 — só o código não tinha acompanhado.

#### 3. Server reiniciado e validado
- Porta 3000 liberada via PowerShell (`Stop-Process` no PID do listener).
- Syntax check nos 3 arquivos alterados (`node -c`) passou.
- `/api/health` → HTTP 200 `{"status":"online","sessoes":1,...}`.
- Sessão DarkFlow renovada via refresh token automaticamente.
- Monitor ativado automaticamente no boot (5 cards antigos purgados pelo housekeeping — ruído conhecido, item 4 de pendências).
- Realtime watcher SUBSCRIBED.

### 🚧 Bloqueador pra submissão TikTok: redirect_uri não é permanente

O redirect URI atual no painel TikTok Developer é `https://www.google.com` — workaround validado 2026-04-22 (user autoriza, pega `?code=` da URL que cai no google.com, faz token exchange manual sem precisar de túnel). Funciona pra uso próprio, mas **não passa na revisão do TikTok pra aprovar `video.publish`**: eles exigem URL Web ou Desktop dedicada e permanente, cadastrada no domínio do app.

### 🎯 Plano escolhido: Opção C — Render como vitrine

**Decisão:** subir um **mini-servidor no Render** (plano free) contendo:
- Página HTML de apresentação do DarkFlow (o "site do app" que o revisor do TikTok vai inspecionar).
- **Rota `/oauth/tiktok/callback`** que recebe o `?code=` do TikTok. Pode exibir o code na tela pro user copiar, ou fazer o token exchange server-side e mostrar os tokens prontos pra colar no `.env` local.
- Redirect URI no painel TikTok Developer trocado pra `https://<slug>.onrender.com/oauth/tiktok/callback` — **URL permanente e aceita pela submissão**.

**O agente continua rodando local** (`C:\Users\Pichau\darkflow-agent`). Render serve só de vitrine + callback OAuth. Nada do pipeline de vídeo (DarkFlow Supabase, ElevenLabs, Claude CLI, Remotion, monitor, YouTube/TikTok upload) migra — isso exigiria custos, variáveis, e não traz ganho.

### 📋 Próxima sessão (2026-04-25+)
1. **Criar app no Render**: repo/subpasta nova, Express + página HTML + rota callback. Nome sugerido: `darkflow-oauth-vitrine`.
2. **Atualizar redirect URI no painel TikTok Developer**: `https://www.google.com` → `https://<slug>.onrender.com/oauth/tiktok/callback`.
3. **Re-autorizar a conta** com o novo redirect (token exchange precisa bater com o redirect que fez o authorize original).
4. **Gravar o vídeo de demonstração TikTok** mostrando:
   - (a) site no Render (vitrine + política de privacidade se exigir)
   - (b) fluxo OAuth completo no navegador
   - (c) chat local respondendo `verificar tiktok` com dados reais da conta
   - (d) chat local respondendo `posta direto` com o erro explicativo do escopo
5. **Submeter o app no TikTok Developer** pedindo `video.publish`.
6. **Housekeeping adiado** (carregado de 2026-04-23): reset dos 5 cards purgados em `videos-criados-por-mim.json`, auto-reconnect do Realtime com refresh de token, remover `@anthropic-ai/sdk` órfão.

### Como retomar o servidor
```
cd C:\Users\Pichau\darkflow-agent
node server/index.js
```
Acessar http://localhost:3000. Se porta ocupada: `powershell -Command "Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`.

### Arquivos alterados nesta sessão (2026-04-24)
- `api/tiktok_api.js` — `testarDirectPost`, `buscarInfoContaTikTok` exportadas; Opção B aplicado (check `uploaded_bytes===videoSize` → `UPLOADED_PROCESSING`, break); mensagem final trocada; status terminal reflete `inbox` ou `uploaded_processing`
- `server/chat.js` — import `tiktok`, detectores `detectarDirectPost`/`detectarStatusTikTok`, intercepts 0a e 0b no topo de `processarComando`
- `scripts/monitor-videos.js` — linha da mensagem final TikTok trocada pra incluir "abra o app TikTok na aba Notificações"
- `memory/CHATBOT-REGRAS.md` — seção nova documentando os dois intercepts
- `memory/SESSAO-ATUAL.md` — este bloco

---

## ⭐ ESTADO NO FIM DE 2026-04-23 — LEIA ISSO PRIMEIRO AO RETOMAR

### Resumo executivo
Sprint longa que começou investigando vídeo "3h14" travado (fila ElevenLabs 50/50), passou por descobrir e replicar via spy Playwright o clique no botão "Gerar Vídeo" (2 PATCHes no Supabase), automatizar tudo via Realtime watcher, implementar fluxo de aprovação antes de postar no YouTube/TikTok, e validar o upload real do TikTok. Tudo aplicado no código e nas memórias.

### ✅ O que está FUNCIONAL ponta-a-ponta agora

#### 1. Voz — fallback DarkVI/Ronald enquanto ElevenLabs está fora
- Flag `ELEVENLABS_FORA = true` em **DOIS arquivos** (manter sincronizadas):
  - `api/voice-selector.js` → `selecionarVoz()` short-circuit retorna Ronald direto sem consultar `/functions/v1/elevenlabs-list-voices`
  - `api/darkflow_api.js` → `criarVideo()` override force-troca `elevenlabs` → `darkvi` antes do POST
- Voz: `voice_provider: 'darkvi'`, `voice: 'cfefb4d6-f863-47ba-a1a4-ef8178410da7'`, `voice_name: 'Ronald'`
- **Backend normaliza**: `darkvi` no POST → banco grava `darkflow_voices` (não enviar esse valor direto, dá VALIDATION_VOICE_INVALID).
- Quando ElevenLabs voltar: mudar `ELEVENLABS_FORA = false` nos 2 arquivos.

#### 2. Script limpo antes do POST (fix do extrator em `server/chat.js`)
Pipeline aplicado em `criarVideoNaAPI`:
```js
script_text: pendente.roteiro
  .split(/\n[━\-_=]{3,}/)[0]                               // corta footer "━━━"
  .replace(/\n+Digite\s+["']?aprovado["'][\s\S]*$/i, '')   // corta "Digite aprovado…"
  .replace(/^\s*CENA\s*\d+\s*:\s*/gim, '')                 // remove "CENA X:"
  .replace(/\n{3,}/g, '\n\n').trim()
```
- `pendente.roteiro` NÃO é modificado na fonte (`gerarPromptsVisuais` depende dele pra split por cena)
- TTS agora NÃO lê "CENA ZERO" nem "Digite aprovado" em voz alta.

#### 3. Legenda queimada — `subtitle_settings` obrigatório
- `auto_subtitles: true` + `subtitle_color: 'Amarelo'` só geram o `.srt` no bucket; **não queimam no MP4**.
- Fingerprint descoberta em cards antigos funcionais: objeto `subtitle_settings` de 15 campos (cor `#FFFF00`, fontSize 50, position bottom, captionStyle `tiktok-center`, etc.). Adicionado como default em `criarVideo()` + validação `enabled===true`.
- Código em `api/darkflow_api.js`.

#### 4. Imagens — prompt visual dinâmico + timing correto
- `server/chat.js:gerarInstrucoesVisuais(tema, roteiro)` chama `claude -p` pra gerar parágrafo único em PT como "diretor de fotografia". Prompt inclui **regras obrigatórias de imagens perturbadoras** (objetos impossíveis, reflexos errados, presenças implícitas, exemplos bom/ruim).
- `criarVideo()` calcula `auto_images_interval = round(duracao_segundos / count)` via `calcularIntervalImagens()` — cobre 100% da duração (sem isso as imagens terminam em 42% do vídeo).

#### 5. Auto-render após AGUARDANDO — `dispararRender()` + Realtime watcher
- **Spy Playwright** descobriu: clique em "Gerar Vídeo" faz 2 PATCHes específicos em `video_cards`:
  - PATCH 1: `{progress:5, progress_message:'Iniciando geração de vídeo...', has_error:false, video_generation_triggered:true, download_url:null, job_id:null, status_url:null, generation_lock:false, generation_lock_timestamp:null}`
  - PATCH 2 (~1.6s depois): `{retry_count:0, has_error:false, error_logs:null}`
- `api/darkflow_api.js` → `dispararRender(cardId)` replica isso exatamente.
- `scripts/monitor-videos.js` → `iniciarRealtimeWatcher()` subscreve `video_cards` filtrado por user_id. Ao ver `status='gerar-video' && progress===100 && !progress_message` → chama `dispararRender`. Também detecta `concluido + download_url` → grava `pendente-postagem.json`.
- `verificarVideos()` (cron 50min) tem fallback idêntico.
- Set `disparados` anti-duplicação entre Realtime e cron.

#### 6. Monitor auto-ativado no boot do server
- `server/index.js` detecta cards pendentes (`!postado && !dispensado`) em `videos-criados-por-mim.json` e chama `monitor.ativarMonitor()` automaticamente — sobe cron + Realtime watcher + check inicial via `verificarVideos()`.
- **Nunca mais precisa rodar `monitor-card.js` em terminal separado.**

#### 7. Confirmação antes de postar — sempre aguarda aprovação
- `scripts/monitor-videos.js` e `monitor-card.js` (fallback) gravam `memory/pendente-postagem.json` com `{card_id, titulo, download_url, timestamp}`.
- `server/chat.js` tem `fs.watchFile(pendente-postagem.json)` que broadcast via WebSocket: _"✅ Vídeo X pronto! Posso postar?"_
- Intercept em `processarComando` (linha ~233): aprovação (`sim`, `pode`, `posta`, `postar`, `aprovado`, `vai`, `ok`, `confirma`, `manda`, `publica`, `publicar`) → chama `processarVideoConcluido`. Rejeição (`não`, `nao`, `espera`, `cancela`, `depois`) → seta `dispensado:true` no card, cron não re-avisa.
- Postagem manual: `posta <titulo|id>` busca no `videos-criados-por-mim.json` e posta (limpa `dispensado`).

#### 8. `adicionarVideoCriado` IMEDIATO + defensivo
- Em `criarVideoNaAPI`, `adicionarVideoCriado()` movido pra ANTES de `moverParaGerarRoteiro`, dentro de `try/catch`. Se escrita local falhar, loga mas não interrompe (card já está no Supabase).

#### 9. TikTok — upload real em sandbox
- **TikTok OAuth confirmado funcional**: `TIKTOK_SCOPE=user.info.basic,video.upload`. Secret correto: `UNbywBx1ji7vMkibBFcm7AQpwh7lTJKQ` (`wh7l` com L minúsculo — não `wh7I` com i maiúsculo). Typo foi causa do `invalid_client` inicial.
- `api/tiktok_api.js` → `uploadTikTok()` faz **init → PUT → polling** via API oficial, envia rascunho REAL (escopo `video.upload` funciona em sandbox).
- **SANDBOX_MODE e flag `TIKTOK_SANDBOX` removidos** do código e do `.env`. Antigo comportamento "simulado" foi erro de entendimento.
- **Teste real validado em 2026-04-24 ~01:32 UTC** (Obituário `0441ab9b`):
  - Init: OK, `publish_id=v_inbox_file~v2.7632131996747417618`
  - PUT: 52.3 MB entregues, HTTP 200
  - Status: 10 tentativas de 3s, todas `PROCESSING_UPLOAD` com `uploaded_bytes: 52324063` (= videoSize), `error.code: "ok"`
  - Nosso código declarou timeout — **mas o upload foi entregue com sucesso**. TikTok leva 5-30min pra processar no servidor deles.

### ⚠️ PENDÊNCIA — fix do TikTok polling NÃO aplicado ainda

Último diff aprovado mas **não aplicado** antes do user sair (Opção B):

```diff
+    const uploadedBytes = statusData.data && statusData.data.uploaded_bytes
+    if (s === 'PROCESSING_UPLOAD' && uploadedBytes === videoSize) {
+      console.log(`✓ Bytes entregues (${videoSize}B) — TikTok processando no servidor, sucesso antecipado`)
+      statusFinal = 'UPLOADED_PROCESSING'
+      break
+    }
```

+ troca das mensagens finais em `api/tiktok_api.js` e `scripts/monitor-videos.js` pra: _"✅ TikTok: vídeo enviado com sucesso — abra o app TikTok na aba Notificações para revisar e publicar"_.

**Regra correspondente já atualizada em `CHATBOT-REGRAS.md`** antecipadamente, mas o código ainda tem o polling que declara timeout após 30s. Aplicar 3 diffs + restart antes de próximo upload TikTok.

### 📋 Pendências pra próxima sessão (2026-04-24+)

1. **Aplicar os 3 diffs do TikTok Opção B** acima (`api/tiktok_api.js` + `scripts/monitor-videos.js`).
2. **Implementar `testarDirectPost()`** — função pra testar o fluxo `/v2/post/publish/video/init/` (sem `/inbox/`) que publica direto sem interação manual. Exige escopo `video.publish` + app auditado em produção. Pra gente testar em sandbox, pode exigir adicionar a conta TikTok como "Target User" no painel do app.
3. **Verificar se conta TikTok (open_id `-000cMA_…`) está como Target User + privada** — condição pra sandbox aceitar uploads.
4. **Reset periódico de `videos-criados-por-mim.json`**: 5 cards antigos aparecem como "não encontrado" a cada ciclo do cron (housekeeping do DarkFlow purgou). Ruído no log. Escrever limpeza automática (marcar `purgado: true` depois de N falhas).
5. **Token Realtime expira**: `(realtime: CHANNEL_ERROR)` visto em 2026-04-24T01:16:27. Reconnect nativo funcionou, mas se virar recorrente, implementar auto-reconect com refresh de token.
6. **`@anthropic-ai/sdk` ainda no `package.json` sem uso** — remover na próxima limpeza.

### 🏗️ Arquitetura final (visão ponta-a-ponta)

```
User → chat (localhost:3000) → gera roteiro → aprova
  ↓
criarVideoNaAPI (chat.js):
  - gerarInstrucoesVisuais (Claude → parágrafo visual)
  - voiceSelector (short-circuit Ronald)
  - criarVideo (POST Supabase com subtitle_settings, auto_images_interval calc, override voice)
  - adicionarVideoCriado IMEDIATO (try/catch)
  - moverParaGerarRoteiro
  - monitor.ativarMonitor() → cron + Realtime watcher
  ↓
DarkFlow: gerar-roteiro → gerar-narracao → gerar-imagens → gerar-video AGUARDANDO
  ↓
Realtime watcher detecta AGUARDANDO → dispararRender (2 PATCHes)
  ↓
DarkFlow renderiza Remotion → status=concluido + download_url
  ↓
Realtime watcher detecta conclusão → grava pendente-postagem.json
  ↓
fs.watchFile no chat → broadcast WebSocket → pergunta ao user
  ↓
User responde "sim" → processarVideoConcluido:
  - downloadVideo (R2 → local)
  - uploadYoutube (Data API v3, público)
  - uploadTikTok (init → PUT → polling; PROCESSING_UPLOAD = sucesso)
  - notifica resultado
```

### Arquivos alterados nesta sprint (2026-04-23)
- `api/darkflow_api.js` — override voice, `subtitle_settings`, `calcularIntervalImagens`, `dispararRender`
- `api/voice-selector.js` — flag `ELEVENLABS_FORA` + short-circuit
- `api/tiktok_api.js` — removido SANDBOX_MODE, init→PUT→polling (pendente fix Opção B)
- `server/chat.js` — regex extrator, `gerarInstrucoesVisuais` async, `adicionarVideoCriado` antes, watcher + intercepts postagem, log `[PROMPT] regras carregadas`
- `server/index.js` — auto-ativa monitor no boot se houver pendentes
- `scripts/monitor-videos.js` — Realtime watcher + auto-render + auto-grava pendente
- `scripts/monitor-card.js` — grava pendente quando detecta `download_url`
- `scripts/spy-render-button.js` — criado (spy do clique)
- `memory/CHATBOT-REGRAS.md` — reescrito com todas as regras
- `memory/CRITICAL-DARKFLOW-AUTOMATION.md` — várias seções atualizadas
- `memory/ENV-KEYS.md` — novo, lista de chaves `.env`
- `.env` — removido `TIKTOK_SANDBOX`
- `.gitignore` — `memory/spy-render-dump.json` + `memory/pendente-postagem.json`

---

## ⭐ ESTADO NO FIM DE 2026-04-22 — LEIA ISSO PRIMEIRO AO RETOMAR

### O que está 100% funcional
- **Auth DarkFlow auto-renovável** (`api/auth-darkflow.js`). `config/credentials.json` válido. Se o refresh falhar, `loginAutomatico()` roda Playwright com email/senha hardcoded. Sessões 1-2.
- **Voice selector** (`api/voice-selector.js`) usa a edge function **`POST /functions/v1/elevenlabs-list-voices`** com body `{"language":"pt"}` — mesma fonte da UI do DarkFlow. Retorna `voice_id` alphanumeric ElevenLabs, `voice_provider: 'elevenlabs'`. 56 vozes PT, ranking por tipo (atmosférico/psicológico/íntimo/cotidiano) × duração. Sessão 6.
- **Schema do POST `video_cards`** alinhado 1:1 com o que a UI envia (validado via spy Playwright em sessão 6). Campos corretos: `voice` (não `voice_id`), `voice_provider: 'elevenlabs'`, `language: 'pt-BR'`, `theme_type: 'roteiro_pronto'`, `visual_images_mode: 'auto_outline'`, `auto_images_provider: 'h200'`. Backend preenche `ai_provider`/`ai_model`/`source_page` sozinho.
- **Campo de URL final do vídeo** é `download_url` (não `video_url`). Fixado em `darkflow_api.js` e `scripts/monitor-videos.js`.
- **YouTube OAuth completo.** `.env` tem `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`. Redirect cadastrado no Google Cloud Console: `http://localhost:3000/oauth/youtube/callback`. `getYoutubeToken()` renova access tokens automaticamente. `uploadYoutube()` faz upload resumable via googleapis SDK. Helper `scripts/youtube-oauth.js` reusable se o refresh token for revogado. Sessão 5.
- **Teste E2E validado em 2026-04-22 ~11h UTC:** card `619c7583-9bf5-42f9-b485-468f9535c532` avançou de `videos-a-fazer` → `gerar-roteiro` → `gerar-narracao` com voz Raquel (ElevenLabs). Sem VALIDATION_VOICE_INVALID.

### Pendências ao retomar
1. **TikTok OAuth inicial** (sessão 7, 2026-04-22): infraestrutura completa, falta credenciais do usuário pra rodar.
   - **Mudança arquitetural:** abandonamos `tiktok-tokens.json` — agora tudo no `.env` (single source of truth, mesmo padrão do YouTube).
   - **`api/tiktok_api.js` reescrito** em modo sandbox:
     - `SANDBOX_MODE` lê `TIKTOK_SANDBOX` (default `true`). Quando true, `uploadTikTok` retorna `{sandbox: true, simulado: true, mensagem: ...}` sem chamar a API TikTok.
     - Caminho produção (init/PUT chunked upload pra `/v2/post/publish/inbox/video/init/`) mantido pra ativar quando `TIKTOK_SANDBOX=false`.
     - `renovarTokenTikTok()` e `getTokenTikTok()` reescrevem o `.env` via `atualizarEnv()`. Mesmo padrão de refresh do YouTube.
     - `uploadVideo` mantido como alias de `uploadTikTok` (retrocompat com `monitor-videos.js` e `upload-tiktok.js`).
   - **`scripts/tiktok-oauth.js` criado** (mesmo padrão robusto do `youtube-oauth.js`):
     - Scope hardcoded: `user.info.basic` (sandbox só libera isso; video.upload/video.publish exigem aprovação em prod).
     - Valida `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` no `.env` antes de rodar — falha cedo com mensagem clara.
     - Sobe HTTP server efêmero na `TIKTOK_OAUTH_PORT` (default 3000), abre browser com authUrl, captura code+state (valida CSRF), troca por tokens em `POST /v2/oauth/token/`, salva `TIKTOK_ACCESS_TOKEN`, `TIKTOK_REFRESH_TOKEN`, `TIKTOK_OPEN_ID`, `TIKTOK_SCOPE` no `.env`.
   - **`scripts/monitor-videos.js` atualizado**: usa `uploadTikTok` (novo nome), trata flag `sandbox` separadamente do sucesso real (não marca `tiktok_inbox: true` quando simulado; notifica "modo sandbox — upload simulado").
   - **`scripts/upload-tiktok.js` atualizado**: mesma lógica sandbox-aware.
   - **`.env` ganhou placeholders** (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_REFRESH_TOKEN`, `TIKTOK_OPEN_ID`, `TIKTOK_SCOPE`, `TIKTOK_SANDBOX=true`).
   - **Limitação documentada:** upload real fica pendente da aprovação do app em produção. Sistema já está pronto pra alternar — basta `TIKTOK_SANDBOX=false` no `.env` depois da aprovação.

   **✅ RESOLVIDO em 2026-04-22 ~21h:** User obteve tokens usando `https://www.google.com` como redirect_uri (workaround: autoriza no TikTok, pega `?code=` da URL que cai em google.com, faz token exchange manual sem precisar de túnel). Funcionou após descobrir que o `client_secret` copiado tinha `I` (i maiúsculo) em vez de `l` (L minúsculo) numa posição — 2 primeiros token exchanges retornaram `invalid_client` até o user corrigir o caractere. Valor correto: `UNbywBx1ji7vMkibBFcm7AQpwh7lTJKQ` (com `wh7l`, NÃO `wh7I`).

   **Tokens atuais no `.env` (2026-04-22):**
   - `TIKTOK_CLIENT_KEY=sbaw63pv9quvx62xp8`
   - `TIKTOK_CLIENT_SECRET=UNbywBx1ji7vMkibBFcm7AQpwh7lTJKQ`
   - `TIKTOK_REDIRECT_URI=https://www.google.com`
   - `TIKTOK_ACCESS_TOKEN` (válido 24h, auto-renovável via `renovarTokenTikTok()`)
   - `TIKTOK_REFRESH_TOKEN` (válido 365 dias)
   - `TIKTOK_OPEN_ID=-000cMA_laeECJm5HrPdpVk1yMm4-6AW9UvR`
   - `TIKTOK_SCOPE=user.info.basic,video.upload` — **surpresa:** sandbox retornou também `video.upload` (em vez de só `user.info.basic`). Significa que o app já tem esse scope liberado. Ainda assim mantemos `TIKTOK_SANDBOX=true` por instrução explícita do user. Se quiser testar upload real, basta `TIKTOK_SANDBOX=false`.

   **Lição aprendida para próximas sessões:** secrets TikTok são 32 chars base62. Caracteres confundíveis (I maiúsculo vs l minúsculo, O vs 0, 1 vs l) são frequentes em fontes sem serifa. Se `invalid_client` persistir com code novo, desconfiar de typo no secret antes de regenerar.
2. **Card `619c7583-9bf5-42f9-b485-468f9535c532`** estava processando no DarkFlow no momento da pausa. Ao retomar, verificar se chegou em `concluido` e se tem `download_url`. Comando para checar:
   ```
   node -e "require('./api/darkflow_api').checarStatusCard('619c7583-9bf5-42f9-b485-468f9535c532').then(c => console.log(c))"
   ```
3. **Upload real no YouTube** ainda não testado ponta-a-ponta (só `getYoutubeToken()`). Quando o card acima concluir, vale baixar o mp4 e testar `node scripts/upload-youtube.js <arquivo> "[TESTE] Reflexo"`.
4. **`@anthropic-ai/sdk`** continua listado no `package.json` mas não é usado (legado). Remover quando lembrar.

### Como retomar o servidor
```
cd C:\Users\Pichau\darkflow-agent
node server/index.js
```
Acessar http://localhost:3000. Se porta 3000 ocupada: `powershell -Command "Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`.

### Arquivos-chave novos/modificados nessa sprint (2026-04-22)
- Novos: `api/auth-darkflow.js`, `api/voice-selector.js`, `scripts/get-initial-token.js`, `scripts/youtube-oauth.js`, `scripts/spy-tts.js` (ferramenta diagnóstica — manter para futuras inspeções de schema)
- Modificados: `api/darkflow_api.js`, `api/youtube_api.js`, `server/chat.js`, `scripts/upload-youtube.js`, `scripts/monitor-videos.js`, `.env`, `.gitignore`, ambos os arquivos `memory/`
- Deletados: `server/auth.js` (órfão após migração de auth)

---

## SESSÃO 6 (2026-04-22) — Correção do VALIDATION_VOICE_INVALID

Erro `VALIDATION_VOICE_INVALID` em `/api/tts` motivou inspeção via spy Playwright (`scripts/spy-tts.js`) das requests reais da UI. Descobertas:

- **`voice_provider: 'darkflow_voices'` era chute inventado na sessão 1** — valor NÃO aceito pelo backend. Valores reais: `'elevenlabs'` ou `'darkvi'`. Corrigido o default em `api/darkflow_api.js` para `'elevenlabs'`.
- **A fonte de vozes era a tabela errada.** `max_tts_voices` não é consumida pela UI. A UI usa:
  - `POST /functions/v1/elevenlabs-list-voices` body `{"language":"pt"}` — edge function que consolida
  - `GET /rest/v1/voice_catalog?provider=eq.elevenlabs|darkvi` — tabela real
- `api/voice-selector.js` reescrito para chamar a edge function. Schema: `voiceId`, `name`, `previewUrl`, `category`, `language`, `gender`, `description`, `labels`. Ranking ajustado (sem `use_case`/`age` que não vêm nessa resposta).
- POST real da UI **não envia `source_page`** — removido do nosso POST (backend preenche).
- POST real da UI envia **`auto_images_provider: 'h200'`** — adicionado.
- `scripts/spy-tts.js` foi deixado no projeto para re-diagnosticar se o schema mudar no futuro.
- **Bug paralelo corrigido:** `checarStatusCard` e `downloadVideo` usavam `video_url` (campo inexistente), quebrando com 400. Campo correto é **`download_url`** — fixado em `api/darkflow_api.js` e em `scripts/monitor-videos.js` (também salva `download_url` no memory/videos-criados-por-mim.json). `checarStatusCard` agora também seleciona `progress` e `progress_message`.
- **Teste E2E passou (22/04/2026):** card `619c7583-9bf5-42f9-b485-468f9535c532` criado com voz `Raquel - Expressive and Energetic` (elevenlabs voiceId `GDzHdQOi6jjf8zaXhCYD`), avançou de `videos-a-fazer` → `gerar-roteiro` → `gerar-narracao` com `has_error: false` e `progress_message: "Roteiro personalizado pronto! Iniciando narração..."`. O VALIDATION_VOICE_INVALID some de vez.

## SESSÃO 5 (2026-04-22) — YouTube API OAuth2

- `.env` recebeu `YOUTUBE_CLIENT_ID` e `YOUTUBE_CLIENT_SECRET` (OAuth2 Google Cloud). `YOUTUBE_REFRESH_TOKEN` **ainda vazio** — aguardando usuário colar.
- `api/youtube_api.js` refatorado:
  - `getOAuth2Client()` lê credenciais do `.env` e retorna cliente com refresh_token setado. Cache por processo.
  - `getYoutubeToken()` → chama `oauth2.getAccessToken()` do googleapis (renova access token automaticamente usando refresh_token quando expirado; TTL de 1h).
  - `uploadYoutube(videoPath, titulo, descricao, opts)` — função principal. Alias `uploadVideo` preservado para compatibilidade com `scripts/monitor-videos.js`.
  - Metadados padrão: tags `['historiadeterror','terror','medo','creepy','sussurrosnaescuridao']`, categoryId `22` (Entertainment), privacy `public`, `defaultLanguage`/`defaultAudioLanguage` `pt`, `selfDeclaredMadeForKids: false`.
  - Validações: arquivo existe, título não vazio, token resolve.
  - Resumable upload é automático no `googleapis` quando se passa `media: { body: fs.createReadStream(...) }` — o SDK escolhe entre simple/resumable por tamanho. Inclui callback `onUploadProgress` com progress bar no stdout.
  - Retorna link no formato `https://youtube.com/watch?v=VIDEO_ID`.
  - Mantidas as funções `gerarAuthUrl()` e `trocarCodigoPorToken(code)` para refluxar o OAuth se o refresh token expirar.
- `scripts/upload-youtube.js` passa a usar `uploadYoutube` explicitamente.
- Teste `getYoutubeToken()` rodado → falhou com a mensagem esperada `"YOUTUBE_REFRESH_TOKEN não configurado no .env"`, confirmando que só falta o token.
- **`scripts/youtube-oauth.js` criado** para automatizar a obtenção do refresh_token. Sobe servidor HTTP efêmero em `localhost:3000/oauth/youtube/callback`, gera authUrl manualmente via `URLSearchParams` (googleapis SDK tinha omitido `response_type`), abre browser automaticamente (Windows: `cmd /c start`), captura code, chama `trocarCodigoPorToken`, e reescreve `YOUTUBE_REFRESH_TOKEN` no `.env`. Timeout 5min, páginas HTML de sucesso/erro temáticas. Requer porta 3000 livre (parar o server principal antes).
- **Redirect URI cadastrado no Google Cloud Console:** `http://localhost:3000/oauth/youtube/callback`. Mantê-lo lá — se for revogado ou mudado, o OAuth quebra.
- **OAuth completado em 2026-04-22 ~13:38 UTC.** Scopes: `youtube.upload`. `YOUTUBE_REFRESH_TOKEN` persistido no `.env`. Validação `getYoutubeToken()` retorna access_token válido (253 chars, prefixo `ya29.a0...`).

## SESSÃO 4 (2026-04-22) — Correção do schema do POST video_cards

Erro 400 "campo voice_id não existe" motivou inspeção completa do schema real. Descobertas:

- **O campo de voz é `voice`** (uuid de `max_tts_voices.id`), não `voice_id`. A tabela `video_cards` tem 133 colunas e `voice_id` simplesmente não existe.
- Schema antigo estava mandando também `language: 'pt'` — o valor aceito é `pt-BR`.
- Cards reais anteriores (criados via UI) sempre incluem: `theme_type: 'roteiro_pronto'`, `visual_images_mode: 'auto_outline'`, `source_page: 'gerar-video'`. Incluídos no POST para bater 1:1 com o padrão da UI.
- `ai_provider`/`ai_model` **não devem ser mandados** — backend preenche com `'google'`/`'gemini-2.0-flash-exp'` automaticamente. Confirmado no card de teste.
- Campos provider-específicos que existem mas só se aplicam a outros providers (Polly, Speechma, Unreal, Darkvoice) — deixados de fora porque voice_provider é `darkflow_voices`.
- **Teste E2E passou em 22/04/2026:** card `400c9f29-85f0-4fef-b5b6-1814f28375d6` criado, movido para `gerar-roteiro`, com voz Matheus escolhida dinamicamente pelo voice-selector, trilha uploaded no bucket `avatars`.

## SESSÃO 3 (2026-04-22) — Sistema unificado de seleção de voz

- **`api/voice-selector.js`** (novo) substitui `buscarVoiceId('Ronald')`. Escolha dinâmica por roteiro.
- Descoberta: tabela real é **`max_tts_voices`** (não `voices`/`tts_voices`/`darkflow_voices`). 1000 vozes totais, 178 em `language=pt`.
- Schema aproveitado no ranking: `name`, `description`, `use_case` (`narrative_story|conversational|social_media|characters_animation|advertisement|informative_educational`), `category`, `accent`, `gender`, `age`.
- `voice_id` para o DarkFlow = `id` uuid interno da tabela (não o `voice_id` elevenlabs que também existe). `voice_provider` fixo `'darkflow_voices'`.
- Ranking pondera 4 tipos narrativos (atmosférico/psicológico/íntimo/cotidiano) × duração (curta/longa) usando regex sobre campos descritivos, com penalizações para `characters_animation`, `advertisement` e termos festivos/infantis.
- Removidas de `api/darkflow_api.js` as funções legadas `buscarVoiceId` e `buscarVoiceIdPlaywright`.
- Integração em `server/chat.js` → `criarVideoNaAPI`: agora chama `voiceSelector.selecionarVoz(pendente.roteiro)`, mostra motivo no chat, e envia `voice_id`+`voice_name`+`voice_provider` ao `criarVideo`.
- **Teste validado (22/04/2026):** roteiro íntimo curto ("Acordei no meio da noite…") → escolheu **Matheus - Calm & Clear Narrator** (8pts, use_case=narrative_story).

## SESSÃO 2 (2026-04-22) — Auto-renovação completa de sessão

Implementado sistema que elimina intervenção manual para auth no DarkFlow:

- **`api/auth-darkflow.js`** (novo, módulo central) exporta `getValidAccessToken()`, `getSupabaseConfig()`, `loginAutomatico()`, constantes SUPABASE_URL/ANON_KEY/USER_ID.
  - Lê `config/credentials.json`; decodifica payload do JWT; se faltar <60s para expirar, renova com refresh_token.
  - Se refresh falhar (token revogado/expirado), faz **login completo via Playwright** — email + senha hardcoded no módulo, fluxo multi-step real do DarkFlow (email → "Continuar" → senha → "Entrar").
  - Salva o novo par `{access_token, refresh_token, updated_at}` imediatamente após cada renovação.
  - Detecta sucesso do login esperando o localStorage ter `access_token` populado (não depende de URL de redirect).
- **`scripts/get-initial-token.js`** (novo) — chama `loginAutomatico()` para popular `config/credentials.json` pela primeira vez. **Executado com sucesso em 2026-04-22 11:53 UTC**, tokens frescos válidos por 1h.
- **`api/darkflow_api.js`** (refatorado) — todas as 6 funções (`criarVideo`, `moverParaGerarRoteiro`, `checarStatusCard`, `uploadMusicaBucket`, `buscarVoiceId`, `buscarVoiceIdPlaywright`) agora usam `getValidAccessToken()` do novo módulo. Import mudou de `../server/auth` para `./auth-darkflow`.
- **`server/auth.js`** deletado (órfão após migração).
- **`.gitignore`** já protegia `config/credentials.json`.
- **Fluxo de login descoberto:** URL correta é `https://app.darkflow.io/` (redireciona para `/auth`, não `/login` que é 404). Formulário tem 2 etapas: input email + "Continuar" (submit), depois input senha + "Entrar" (submit).
- **`npx playwright install chromium`** executado (Chromium + headless shell ~290MB baixados).
- **Servidor reiniciado** em http://localhost:3000, health check OK.

**Ainda válido da Sessão 1:**

## STATUS DO PROJETO

**Construído hoje (sessão 1):**
- Estrutura completa em `C:\Users\Pichau\darkflow-agent\` (28 arquivos, 0 erros de sintaxe)
- Backend Node.js: `server/index.js` (Express + WebSocket), `server/chat.js` (orquestrador + comandos), `server/auth.js` (refresh token Supabase com cache + auto-renovação), `server/session.js` (multi-usuário in-memory)
- Frontend single-page: `frontend/index.html` + `css/style.css` + `js/app.js` — design preto/vermelho cinematográfico
- Integrações: `api/darkflow_api.js` (Supabase), `api/youtube_api.js` (Data API v3), `api/tiktok_api.js` (renovação automática + inbox)
- Scripts: `scripts/monitor-videos.js` (cron `*/50 * * * *` com auto-desativação), `upload-youtube.js`, `upload-tiktok.js`
- Memória crítica: `CRITICAL-DARKFLOW-AUTOMATION.md`, `TIKTOK-AUTH.md`, `CRITICAL-TIKTOK-UPLOAD.md`
- Documentação: `README.md`, `.env.example`, `tiktok-tokens.json.example`, `config/settings.json`

**Funcionando agora:**
- Servidor rodando em http://localhost:3000 (PID muda a cada reinício)
- WebSocket conectado, multi-usuário OK
- Health check `/api/health` respondendo
- Chat respondendo via Claude Code CLI (~5-30s por mensagem)
- Comandos `/ajuda`, `/status`, `/pendentes`, `/ideias`, `/gerar` reconhecidos
- Frontend renderizando o design final (Anton + Crimson Pro + JetBrains Mono)

**Ainda falta testar (próxima sessão):**
- Fluxo end-to-end: tema → formato → duração → roteiro → aprovação → criação real do card no DarkFlow
- Busca de voice_id dinâmico (RPC Supabase + fallback Playwright)
- Upload da trilha sonora no bucket `avatars`
- Cron de 50 minutos disparando após criação de vídeo
- Postagem real no YouTube e TikTok (depende de credenciais OAuth pendentes)

---

## CONFIGURAÇÕES JÁ FEITAS

- **Refresh token DarkFlow:** `25oq57igfbao` (salvo em `.env` como `DARKFLOW_REFRESH_TOKEN`)
- **Trilha sonora:** `audio/trilha-padrao.mp3` (47.8 MB, copiado de `Downloads/som_fundo/som_fundo.mp3`)
- **Autenticação Anthropic:** via Claude Code CLI (`child_process.spawn('claude', ['-p'])`) — sem API key separada
- **Servidor:** Node.js 18+ Express + WebSocket na porta 3000
- **Dependências instaladas:** 122 pacotes em `node_modules/` (`@anthropic-ai/sdk` ainda listado no package.json mas não usado mais — pode ser removido depois)
- **Supabase ANON_KEY e USER_ID:** preenchidos no `.env`
- **YouTube/TikTok OAuth:** AINDA NÃO CONFIGURADOS — só a estrutura está pronta

---

## INTERFACE

- Design redesenhado **2x** — primeira versão genérica (preto + vermelho básico), segunda versão temática horror cinematográfico (versão final aprovada)
- **Fontes:** Anton (logo + títulos), Crimson Pro (corpo das mensagens, clima literário), JetBrains Mono (timestamps, atalhos /cmd, badges)
- **Paleta:** fundo `#050505`, vermelho `#e8213a`, branco osso `#ede9e3`, painel `#0f0f0f`, muted `#4a4a4a`
- **Logo:** `DARK` branco + `FLOW` vermelho em Anton 20px no header (38px no modal com `STUDIO` letter-spacing 0.6em embaixo)
- **Atmosfera do chat:** 4 camadas sobrepostas — vignette radial + mancha vermelha canto superior esquerdo + noise SVG (mix-blend overlay) + scanlines horizontais 2-3px
- **Cantos das mensagens:** top-left + bottom-left a 2px, resto a 10px (lado oposto no usuário)
- **Avatar agente:** "D" em Anton vermelho num quadrado 30x30 — implementado com `font-size: 0` + `::after { content: 'D' }` para sobrepor o emoji 🎬 que o `app.js` injeta sem precisar tocar o JS
- **Typing indicator:** 3 traços horizontais vermelhos pulsando (não círculos)
- **Cursor custom global:** SVG inline com círculo preto 16px + dot vermelho 4px (resetado para `text` em inputs)
- **Empty state do botão enviar:** opacity 0.3 via CSS puro (`:has(:placeholder-shown)`) — sem JS
- **Hint tags abaixo do input:** preenchem mas não enviam (inline script de 6 linhas no fim do HTML, app.js intacto)
- **Arquivos finais:** `frontend/index.html`, `frontend/css/style.css`, `frontend/js/app.js`

---

## DECISÕES TÉCNICAS TOMADAS

- **API key Anthropic:** Claude Code não expõe a chave OAuth como variável de ambiente para processos Node externos — descobrimos isso ao tentar usar `process.env.ANTHROPIC_API_KEY` e voltar `undefined`
- **Solução adotada:** `server/chat.js` chama o binário `claude -p` via `child_process.spawn`, passando o prompt por **stdin** (evita shell escaping de aspas/quebras de linha) com `cwd: os.tmpdir()` (não carrega CLAUDE.md do projeto) e `shell: true` no Windows (resolve o `claude.cmd` shim)
- **Histórico de conversa:** concatenado no prompt a cada chamada (últimas 20 mensagens em formato "Usuário: ...\nAgente: ..."), sem cache
- **Tradeoff de latência:** ~10-30s por mensagem agora vs. ~3-8s com a API direta. Quota consumida da assinatura Claude.ai (OAuth do Claude Code), não de uma API key paga
- **Criação de vídeos:** API direta Supabase (`POST /rest/v1/video_cards` → status 201 → PATCH para `gerar-roteiro` status 200). NUNCA wizard
- **Bucket de música:** `avatars` (não `audio` — esse não existe). Validado em produção
- **Voice ID:** sempre dinâmico via RPC `get_voices` ou fallback Playwright. NUNCA hardcoded
- **Cron de monitoramento:** exatamente 50 minutos (`*/50 * * * *`). Auto-desativa quando `videos-criados-por-mim.json` tem 0 pendentes
- **Aprovação de roteiro:** sempre explícita do usuário ("aprovado", "ok", "sim", "cria", "vai", "yes", "criar", "manda", "beleza"). Sistema NUNCA cria automaticamente após gerar roteiro
- **Imagens:** sempre múltiplos de 5 (5, 10, 15, 20, 25, 30, 35, 40). Prompts em inglês, baseados no roteiro
- **Legendas:** sempre `auto_subtitles: true` + `subtitle_color: "Amarelo"` (validado na resposta da API)
- **Verificação antes de postar:** título do card == esperado AND `status == "concluido"` AND arquivo existe — caso contrário aborta

---

## PRÓXIMOS PASSOS PARA AMANHÃ

1. Testar fluxo completo end-to-end: `/gerar` → escolher tema → formato → duração → ver roteiro → aprovar → conferir card criado no DarkFlow
2. Verificar se a busca de `voice_id` dinâmico está funcionando (RPC `get_voices` ou fallback Playwright para "Ronald")
3. Testar upload da trilha sonora no bucket `avatars` (`darkflow_api.uploadMusicaBucket`)
4. Testar o cron disparando a cada 50min após criação de vídeo (rever logs em `logs/monitor.log`)
5. Configurar OAuth do YouTube e gerar `YOUTUBE_REFRESH_TOKEN` (Data API v3, scope `youtube.upload`)
6. Preencher `tiktok-tokens.json` (renomear do `.example`)
7. Testar postagem real YouTube + TikTok inbox
8. Considerar remover `@anthropic-ai/sdk` do `package.json` (não usado mais, mas fica como leftover)

---

## PARA RETOMAR AMANHÃ

```bash
cd C:\Users\Pichau\darkflow-agent
node server/index.js
```

Acesse: **http://localhost:3000**

Se precisar matar uma instância anterior na porta 3000:
```bash
netstat -ano | grep ":3000 " | grep LISTENING | awk '{print $5}' | head -1 | xargs -I {} taskkill //PID {} //F
```

**Atualize este arquivo conforme o projeto avançar.** Mude a "Data:" do topo, marque os itens dos próximos passos que foram feitos, anote bugs encontrados e decisões novas.
