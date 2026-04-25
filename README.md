# 🔴 DarkFlow Agent

Sistema completo de automação de vídeos de terror para YouTube e TikTok com interface web (chat) e cron de monitoramento.

```
darkflow-agent/
├── server/      # Backend Node.js (Express + WebSocket + Claude API)
├── frontend/    # Interface web (HTML/CSS/JS puro, design preto/vermelho)
├── api/         # Integrações: DarkFlow (Supabase), YouTube, TikTok
├── scripts/     # Cron monitor (50min) + uploads
├── stories/     # Roteiros salvos
├── videos/      # Vídeos baixados
├── audio/       # Trilha sonora padrão (.mp3)
├── memory/      # Regras críticas + IDs criados
├── config/      # Settings + credentials (NÃO commitar)
└── logs/        # Log diário e do monitor
```

---

## 🚀 Setup

### 1. Instalar dependências

```bash
cd darkflow-agent
npm install
npx playwright install chromium   # apenas se quiser usar o fallback Playwright para buscar voice_id
```

### 2. Configurar `.env`

Copie `.env.example` para `.env` e preencha:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
SUPABASE_ANON_KEY=eyJ...   (já vem preenchida no .env.example)
DARKFLOW_REFRESH_TOKEN=    (ver passo 3)

YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
```

### 3. Obter o refresh token do DarkFlow

1. Abra https://app.darkflow.io e faça login
2. Pressione **F12** → aba **Console**
3. Cole e execute:
   ```js
   JSON.parse(localStorage.getItem('sb-ejansudxykwjwgnhdwma-auth-token')).refresh_token
   ```
4. Copie o valor (string começando com algo como `rt.abc...`) e cole em `DARKFLOW_REFRESH_TOKEN` no `.env`

> O sistema renova esse token automaticamente a cada chamada e salva o novo em `memory/.refresh-token`.

### 4. Trilha sonora

Coloque seu arquivo MP3 padrão em:

```
audio/trilha-padrao.mp3
```

### 5. TikTok (opcional para upload)

Renomeie `tiktok-tokens.json.example` para `tiktok-tokens.json` e preencha com valores reais (ver `memory/TIKTOK-AUTH.md`).

### 6. YouTube OAuth (uma vez)

Configure um projeto em https://console.cloud.google.com com **YouTube Data API v3** ativada, baixe `client_id` + `client_secret`, e gere o refresh token via fluxo OAuth (escopo `youtube.upload`).

---

## ▶️ Rodar

```bash
npm start
```

Abre em **http://localhost:3000**.

Qualquer pessoa na mesma rede acessa via `http://<seu-ip>:3000`.

### Rodar o monitor manualmente

```bash
npm run monitor
```

---

## 💬 Comandos do chat

| Comando | Ação |
|---|---|
| `/gerar` | Inicia fluxo (tema → formato → duração) |
| `/gerar [tema]` | Inicia já com tema definido |
| `/ideias` | 10 ideias de terror geradas pela IA |
| `/aprovar` | Aprova roteiro pendente |
| `/rejeitar` | Rejeita e pede outro |
| `/status` | Status de todos os vídeos |
| `/pendentes` | Roteiros aguardando aprovação |
| `/ajuda` | Lista de comandos |

Conversa livre também funciona: *"cria uma história de hospital abandonado"*.

---

## 🎨 Design

- **Nome:** DarkFlow
- **Paleta:** preto (#0a0a0a) e vermelho (#e63946)
- **Fontes:** Syne (display), Space Grotesk (UI), JetBrains Mono (código/chat)
- **Layout:** sidebar com vídeos em produção + ações rápidas, chat central com avatares e indicador de "digitando"

---

## ⏰ Cron Monitor

- **Intervalo:** exatamente **50 minutos** (`*/50 * * * *`)
- **Ativa automaticamente** quando um vídeo é criado
- **Desativa automaticamente** quando a fila fica vazia
- Quando um vídeo termina:
  - Baixa o arquivo MP4
  - Verifica título + status no card
  - Posta no YouTube (Data API v3)
  - Envia para inbox do TikTok
  - Notifica todos os usuários conectados via WebSocket

---

## 🔐 Regras críticas

Leia `memory/CRITICAL-DARKFLOW-AUTOMATION.md` antes de modificar qualquer coisa relacionada a:

- Autenticação Supabase (sempre refresh token)
- Criação via API direta (nunca wizard)
- Voice ID dinâmico (nunca hardcode)
- Bucket de música (`avatars`, não `audio`)
- Cron exato de 50 minutos

---

## 🏗️ Arquitetura

```
[Frontend HTML+JS+WebSocket]
         ⇅
[server/index.js Express+ws]
         ⇅
[server/chat.js — Claude API + comandos]
         ⇅
[api/darkflow_api.js] [api/youtube_api.js] [api/tiktok_api.js]
         ⇅                    ⇅                    ⇅
   Supabase REST       YouTube Data v3       TikTok Open API

[scripts/monitor-videos.js — cron 50min]
         ⇅
   videos-criados-por-mim.json
```

---

## 📦 Stack

- **Node.js 18+**
- **Express + WebSocket (ws)** — servidor + chat em tempo real
- **@anthropic-ai/sdk** — Claude Opus 4.5 para gerar roteiros
- **node-cron** — monitor de 50 minutos
- **googleapis** — YouTube Data API v3
- **playwright** (opcional) — fallback para buscar `voice_id` se a RPC do Supabase falhar
- **node-fetch** — chamadas HTTP

---

## 🐛 Erros conhecidos

| Erro | Causa | Solução |
|---|---|---|
| `Refresh token do DarkFlow ausente` | `.env` não preenchido | Configure `DARKFLOW_REFRESH_TOKEN` |
| `VALIDATION_VOICE_INVALID` | voice_id desatualizado | Já tratado: busca dinâmica |
| `Erro upload da música` | Bucket errado | Já tratado: usa `avatars` |
| `tiktok-tokens.json não encontrado` | Arquivo ausente | Renomeie o `.example` e preencha |
| `Arquivo audio/trilha-padrao.mp3 não encontrado` | MP3 não está na pasta | Coloque seu arquivo lá |
