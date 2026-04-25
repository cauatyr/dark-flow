# ENV-KEYS — chaves esperadas no `.env` do DarkFlow Agent

Referência rápida das variáveis que o projeto lê. Valores sensíveis estão no `.env` real (gitignored).

## Anthropic
- `ANTHROPIC_API_KEY` — chave da Console Anthropic. **Atualmente vazia** — o chat usa `claude -p` via CLI com auth do Claude Code OAuth, não essa key. Mantida no .env por compatibilidade; pode ser removida se nenhum script usar.

## DarkFlow / Supabase
- `SUPABASE_URL` — `https://ejansudxykwjwgnhdwma.supabase.co`
- `SUPABASE_ANON_KEY` — JWT anon do projeto (público por design; respeita RLS)
- `SUPABASE_USER_ID` — `75fc8163-278f-4ff7-9a55-312e87bbafb3` (uuid da conta DarkFlow)
- `DARKFLOW_REFRESH_TOKEN` — legado. `api/auth-darkflow.js` hoje lê do `config/credentials.json` (gitignored), não do `.env`. Pode remover.

## YouTube OAuth (Data API v3)
- `YOUTUBE_CLIENT_ID` — do Google Cloud Console
- `YOUTUBE_CLIENT_SECRET` — do Google Cloud Console
- `YOUTUBE_REDIRECT_URI` — `http://localhost:3000/oauth/youtube/callback` (cadastrado no Google Cloud)
- `YOUTUBE_REFRESH_TOKEN` — obtido via `scripts/youtube-oauth.js` (scope `youtube.upload`). Renova access_token automaticamente via `googleapis` SDK.

## TikTok OAuth (Content Posting API)
- `TIKTOK_CLIENT_KEY` — `sbaw63pv9quvx62xp8` (app sandbox)
- `TIKTOK_CLIENT_SECRET` — 32 chars base62. **ATENÇÃO**: `wh7l` com L MINÚSCULO no meio, não `wh7I` (I maiúsculo). Fonte do bug de `invalid_client` em 2026-04-22.
- `TIKTOK_REDIRECT_URI` — `https://www.google.com` (workaround: TikTok aceita qualquer HTTPS cadastrada; user autoriza, pega `?code=` da URL do google, token exchange manual)
- `TIKTOK_ACCESS_TOKEN` — `act.…` (válido ~24h, auto-renova via `renovarTokenTikTok`)
- `TIKTOK_REFRESH_TOKEN` — `rft.…` (válido ~365 dias)
- `TIKTOK_OPEN_ID` — `-000cMA_laeECJm5HrPdpVk1yMm4-6AW9UvR`
- `TIKTOK_SCOPE` — `user.info.basic,video.upload`. `video.upload` permite upload pra **inbox** do app (rascunho real, sandbox). `video.publish` direto exige app auditado em produção.
- ~~`TIKTOK_SANDBOX`~~ — **REMOVIDO em 2026-04-23**. Código não lê mais (upload é sempre real; sandbox do TikTok Developer só limita visibilidade, não simula).

## Servidor
- `PORT` — `3000` (HTTP + WebSocket do chat em localhost:3000)

## Notas de segurança
- `.env` está no `.gitignore` ✅
- `config/credentials.json` (DarkFlow session tokens) está no `.gitignore` ✅
- Secrets commitados no repo privado `cauatyr/sena` e `cauatyr/spark` — decisão informada do user. **Alertar se esses repos virarem públicos.**
