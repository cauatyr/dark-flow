# 🔴 DarkFlow Agent

Estúdio de automação de vídeos de terror para shorts (TikTok/Reels/Shorts) e vídeos longos. Interface web em chat preto/vermelho, geração de roteiro via Claude Code CLI, criação automática de cards no DarkFlow via API direta (Supabase) e monitoramento em background até o vídeo ficar pronto.

> Quando o vídeo termina, o agente avisa no chat. **Não posta em lugar nenhum** — o download e a publicação ficam por conta do usuário direto pelo painel do DarkFlow.

---

## 📁 Estrutura

```
darkflow-agent/
├── server/        # Express + WebSocket + chamada Claude CLI (server/index.js, server/chat.js)
├── frontend/      # UI "DarkFlow Studio" — HTML/CSS/JS puro, design preto/vermelho
├── api/           # Integrações: auth-darkflow, darkflow_api, voice-selector, tiktok_api*
├── scripts/       # monitor-videos (cron 50min) + helpers OAuth órfãos
├── stories/       # Roteiros aprovados salvos em .md
├── audio/         # trilha-padrao.mp3 (música usada em todo card)
├── memory/        # SESSAO-ATUAL.md, CRITICAL-DARKFLOW-AUTOMATION.md, videos-criados-por-mim.json
├── config/        # credentials.json (NÃO commitar — está no .gitignore)
└── logs/          # Logs do monitor

* api/tiktok_api.js, api/youtube_api.js e scripts/upload-*.js permanecem no repo mas
  estão fora do fluxo principal (upload automático foi removido em 2026-04-24).
```

---

## 🚀 Setup

### 1. Pré-requisitos

- **Node.js 18+**
- **Claude Code CLI instalado e autenticado** — o agente roda `claude -p` via `child_process.spawn`. Não precisa de `ANTHROPIC_API_KEY` pago: o sistema reaproveita a auth OAuth do próprio Claude Code.
- Acesso a uma conta DarkFlow (https://app.darkflow.io) com saldo/permissão para criar vídeos.

### 2. Instalar dependências

```bash
cd darkflow-agent
npm install
npx playwright install chromium    # usado no fallback de login do DarkFlow
```

### 3. `.env`

Copie `.env.example` → `.env` e preencha o que se aplica. Valores realmente necessários para o fluxo principal:

```env
SUPABASE_URL=https://ejansudxykwjwgnhdwma.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_USER_ID=...
PORT=3000
```

`ANTHROPIC_API_KEY`, `DARKFLOW_REFRESH_TOKEN` e os blocos `YOUTUBE_*` / `TIKTOK_*` são legados — não são lidos pelo fluxo atual. Pode ignorar.

### 4. Auth do DarkFlow (automática)

O módulo `api/auth-darkflow.js` cuida sozinho:

1. Lê `config/credentials.json` (access + refresh token).
2. Se o access estiver expirado, renova via refresh token.
3. Se o refresh falhar, faz fallback para login completo via Playwright (email/senha embutidos no módulo) e regrava o `credentials.json`.

Para reprovisionar manualmente:

```bash
node scripts/get-initial-token.js
```

> `config/credentials.json` está no `.gitignore`. Nunca commitar.

### 5. Trilha sonora

Coloque um MP3 padrão em:

```
audio/trilha-padrao.mp3
```

Sem esse arquivo, qualquer tentativa de criar vídeo retorna erro no chat.

### 6. Som ambiente do frontend (opcional)

O botão de áudio ambiente só aparece no header se existir:

```
frontend/audio/ambient.mp3
```

O JS faz `fetch HEAD` e revela o botão automaticamente quando o arquivo está presente. Volume fixo em 10%, persistido em `localStorage.darkflow_ambient`.

---

## ▶️ Rodar

```bash
npm start
```

Acessa em **http://localhost:3000**. Outras máquinas na mesma rede acessam via `http://<seu-ip>:3000`.

Boot mostra:

```
🔴 DARKFLOW AGENT online
📡 http://localhost:3000
✅ Sessão renovada via refresh token
👁️  Realtime watcher SUBSCRIBED (auto-render)
```

> Avisos do tipo `⚠️ <uuid> não encontrado` no boot são **esperados**: são cards criados em outras contas e bloqueados pelo RLS do Supabase. Não é bug.

### Rodar o monitor isolado

```bash
npm run monitor
```

---

## 💬 Comandos do chat

| Comando | Ação |
|---|---|
| `/gerar` | Inicia fluxo guiado (tema → formato → duração) |
| `/gerar [tema]` | Pula direto pro formato com o tema já fixado |
| `/ideias` | 10 sugestões de história de terror geradas pela IA |
| `/aprovar` | Aprova o roteiro pendente — cria o card no DarkFlow |
| `/rejeitar` | Rejeita o roteiro pendente e abre espaço para gerar outro |
| `/status` | Status agregado dos vídeos em produção |
| `/pendentes` | Roteiros aguardando aprovação |
| `/ajuda` | Lista de comandos |

Conversa livre também funciona: *"cria uma história de hospital abandonado em 1 minuto"*. O agente vai puxar contexto da conversa e abrir o fluxo correspondente.

### Durações suportadas

| Duração | Formato | Imagens | Faixa de caracteres |
|---|---|---|---|
| 30s / 1m / 2m / 3m / 5m | TikTok vertical | 5 / 6 / 10 / 15 / 20 | conforme tabela em `server/chat.js` |
| 12m | Vídeo longo | 35 | 8000–9000 |

---

## 🎨 Frontend — DarkFlow Studio

Paleta `#050505 / #e8213a / #ede9e3`. Fontes Anton (display), Crimson Pro (texto), JetBrains Mono (código).

**Features mantidas (estado final 2026-04-24 noite):**

1. **Grain global** — película 16mm via SVG noise + `grain-drift` 8s steps(4)
2. **Glitch logo DARKFLOW** — RGB split ciano/vermelho, ~10s por ciclo
3. **Borda vermelha sangrando** nas mensagens do agente (2px, gradient vertical)
4. **Sidebar status 🟢🟡🔴** — pronto / processando / erro, tooltip nativo + glow
5. **Legenda no rodapé da sidebar**
6. **Lista colapsa em 5 + "ver todos (+N)"**
7. **Botão enviar ⚡** — pulse vermelho no hover, spinner branco em loading
8. **Som ambiente** infra (revela botão se `frontend/audio/ambient.mp3` existir)
9. **Progresso real-time** via WebSocket — barra fina vermelha + "Gerando narração... 45%"
10. **Painel de detalhe** ao clicar num vídeo da sidebar — título, ID, status, duração, data pt-BR, link de download
11. **Placeholder do input**: *"— o que você quer que o mundo tema..."*

**Animações de impacto:**

12. **Blood particles** — 2-4 partículas animadas via Web Animations API ao receber mensagem do agente
13. **Sidebar hover-reveal** — keyframe glitch+glow nos títulos
14. **Intro overlay** — tela preta + cursor piscando 1.2s + fade 0.8s em todo refresh
15. **Heartbeat pulse + áudio 60Hz** — quando chega `notificacao-global` (vídeo concluído)

**Stack de z-index:** `99999` intro, `99998` heartbeat, `9999` grain + blood particles, `5` painel detalhe, `100` modal de login.

---

## ⏰ Monitor (cron 50min)

- Liga sozinho no boot se `memory/videos-criados-por-mim.json` tem cards pendentes
- Liga ao criar vídeo novo, desliga quando a fila esvazia
- Em paralelo, **Realtime watcher** do Supabase reage a `payload.old != payload.new` e dispara `tipo:'video-progresso'` no WebSocket — atualiza barra de progresso na sidebar e no painel de detalhe sem refresh
- Quando `gerar-video` chega em `progress=100 && !progress_message`, dispara render automático
- Quando o status vira `concluido + download_url`:
  - Marca `pronto:true, notificado:true` no JSON local
  - Manda `notificacao-global` no WS → frontend dispara heartbeat + áudio + mensagem do agente
  - **Não posta em lugar nenhum.** O usuário baixa pelo DarkFlow manualmente.

---

## 🔐 Regras críticas

Antes de mexer em qualquer ponto do fluxo de criação, leia `memory/CRITICAL-DARKFLOW-AUTOMATION.md`. Resumo:

- **Sempre** API direta via Supabase, **nunca** o wizard
- **Sempre** voice_id buscado dinamicamente, **nunca** hardcode
- Bucket de música é `avatars`, **não** `audio`
- Cron é exatamente 50 minutos (`*/50 * * * *`)
- Quantidade de imagens é múltiplo de 5
- Subtítulo amarelo
- Aprovação do roteiro é **explícita** (`/aprovar` ou "aprovado")

**Fallback DarkVI/Ronald** quando ElevenLabs cair:

```js
voice_provider: 'darkvi'
voice: 'cfefb4d6-f863-47ba-a1a4-ef8178410da7'
voice_name: 'Ronald'
```

O backend normaliza `darkvi` → grava `darkflow_voices` no banco. PATCH em card parado **não** dispara reprocessamento — sempre criar card novo via `criarVideo()`.

---

## 🏗️ Arquitetura

```
[Frontend HTML+CSS+JS+WebSocket]
              ⇅
[server/index.js — Express + ws]
              ⇅
[server/chat.js — comandos + spawn('claude','-p')]
              ⇅
[api/auth-darkflow.js  ⇄  api/darkflow_api.js  ⇄  api/voice-selector.js]
              ⇅
        Supabase REST + Realtime

[scripts/monitor-videos.js — cron 50min + Realtime watcher]
              ⇅
   memory/videos-criados-por-mim.json
```

**Não há `max_tokens` configurável**: a chamada ao Claude é via CLI. Se precisar de mais tempo de geração, ajuste `CLI_TIMEOUT_MS` em `server/chat.js` (atualmente 300000ms).

---

## 📦 Stack

- **Node.js 18+**, CommonJS
- **Express + ws** — servidor HTTP + WebSocket
- **@supabase/supabase-js** — Realtime watcher do monitor
- **node-fetch** — REST direto pro DarkFlow
- **node-cron** — agendador de 50 min
- **playwright** — fallback de login automático no DarkFlow
- **dotenv**, **fs-extra**, **form-data**
- **Claude Code CLI** (`claude -p`) — não é dependência npm; precisa estar instalado e autenticado no sistema

---

## 🐛 Erros conhecidos

| Sintoma | Causa | O que fazer |
|---|---|---|
| `Arquivo audio/trilha-padrao.mp3 não encontrado` | MP3 padrão não está na pasta | Coloque um MP3 em `audio/trilha-padrao.mp3` |
| `Refresh token expirado` repetido | Refresh do DarkFlow revogado | `node scripts/get-initial-token.js` |
| `[monitor] ⚠️ <uuid> não encontrado` no boot | Card criado em outra conta (RLS) | Esperado. Para limpar, edite `memory/videos-criados-por-mim.json` |
| Botão de som não aparece | `frontend/audio/ambient.mp3` ausente | Coloque o arquivo; o botão revela sozinho |
| `claude: command not found` no spawn | CLI do Claude Code não está no PATH | Instale o Claude Code e teste `claude --version` antes de subir o server |

---

## 📜 Licença

MIT — Cauatyr.
