# REGRAS OPERACIONAIS — DarkFlow Agent (chatbot)

Essas regras são injetadas em todo prompt do agente. Sempre obedecer.

## Voz — fallback obrigatório quando ElevenLabs falhar
Se o usuário relatar problema de narração (`VALIDATION_VOICE_INVALID`, erro 429 ElevenLabs, "fila cheia 50/50", "manutenção", "too many tasks") → orientar uso da DarkVI/Ronald:

- `voice_provider`: `'darkvi'` (o backend normaliza pra `darkflow_voices` ao gravar)
- `voice` (UUID DarkVI): **`cfefb4d6-f863-47ba-a1a4-ef8178410da7`**
- `voice_name`: `Ronald`

NUNCA inventar voice_id. Se não souber o UUID de outra voz, usar `voice-selector.js` ou perguntar.

## Fluxo DarkFlow (orientação ao usuário na UI app.darkflow.io)
Caminho correto: clicar em **"Roteiro Personalizado"** primeiro → depois escolher o tipo de vídeo. O chatbot já cria cards via API com `theme_type: 'roteiro_pronto'` (equivalente).

## Upload YouTube + TikTok REMOVIDO (decisão 2026-04-24)
Sistema **não posta em lugar nenhum automaticamente**. Quando um card chega em `concluido + download_url`:
- `scripts/monitor-videos.js` (Realtime watcher + cron 50min) marca `pronto:true` no `videos-criados-por-mim.json` e dispara **uma única notificação** via WebSocket:
  > ✅ **[título]** está pronto! 🎬 Acesse o DarkFlow para baixar e publicar.
- Usuário baixa o mp4 direto no DarkFlow e posta manualmente onde quiser.
- Flag `notificado:true` no card evita re-aviso pelo cron.

**Funções/flags REMOVIDAS (não tentar reintroduzir sem pedido explícito):**
- `processarVideoConcluido` (monitor-videos.js)
- `processarAprovacaoPostagem`, `detectarAprovacaoPostagem`, `detectarRejeicaoPostagem`, `parseComandoPostarManual`, `iniciarWatcherPostagem`, `lerPendentePostagem`/`limparPendentePostagem` (server/chat.js)
- Flag `dispensado` e `aguardar_confirmacao` em `videos-criados-por-mim.json` — legado de quando havia aprovação, hoje ignoradas.
- `memory/pendente-postagem.json` — arquivo intermediário não é mais usado.
- Comando de chat `posta <título>` — removido.

**Intercepts de chat preservados** (são DIAGNÓSTICO, não upload):
- `verificar tiktok` / `status tiktok` / `conectar tiktok` → `GET /v2/user/info/` (mostra conta conectada)
- `posta direto` / `direct post` / `video.publish` → `POST /v2/post/publish/video/init/` (testa escopo, mostra erro explicativo)

## Status dos cards
- Progressão real (confirmada 2026-04-23): `videos-a-fazer` → `gerar-roteiro` → `gerar-narracao` → `gerar-imagens` → `gerar-video` → `concluido`
- Status `'pending'` e similares são REJEITADOS pelo check constraint. Só os de cima são válidos.
- **`gerar-video` tem 2 sub-estados pelo `progress_message`**:
  - `progress=100 && progress_message=null` → AGUARDANDO trigger do render. **Automatizado** via `dispararRender()` disparado pelo `monitor-card.js`.
  - `progress<100 && progress_message="Remotion SSR: X/Y frames" | "Mesclando audio..." | "Finalizando..."` → já renderizando.

## Render automático (descoberto 2026-04-23 via spy Playwright)
O "clique" em "Gerar Vídeo" na UI faz **2 PATCHes em `video_cards`** no Supabase:
- **PATCH 1** — dispara o worker Remotion com esta fingerprint exata:
  `{progress:5, progress_message:'Iniciando geração de vídeo...', has_error:false, video_generation_triggered:true, download_url:null, job_id:null, status_url:null, generation_lock:false, generation_lock_timestamp:null}`
- **PATCH 2** — ~1.6s depois, limpa retry/error:
  `{retry_count:0, has_error:false, error_logs:null}`

Função `dispararRender(cardId)` em `api/darkflow_api.js` replica essa sequência. O **Realtime watcher do server** (`scripts/monitor-videos.js:iniciarRealtimeWatcher`) detecta `status==='gerar-video' && progress===100 && !progress_message` e chama `dispararRender` automaticamente. Watcher é ativado no boot do server quando há cards pendentes — não precisa rodar `monitor-card.js` separado. Cron 50min é fallback. **NÃO orientar o usuário a clicar manualmente** — é automático agora.

## Legendas — burn-in no MP4
- `auto_subtitles: true` + `subtitle_color: 'Amarelo'` → geram o `.srt` no bucket, MAS não queimam no vídeo final.
- **`subtitle_settings.enabled: true`** é o que dispara burn-in no Remotion. `criarVideo()` já passa default com cor amarela, posição bottom, fontSize 50, captionStyle tiktok-center.
- Se o usuário pedir "legenda grande" / "legenda no meio" / "palavra por palavra", ajustar `subtitle_settings.fontSize`, `position: 'center'` ou `displayMode: 'word-by-word'` (+ `wordsPerDisplay: 3` + `motionEffect: true`).

## Timing das imagens (auto_images_interval)
- **Fórmula obrigatória:** `auto_images_interval = round(duracao_segundos / auto_images_count)`. Sem isso, as imagens cobrem só (count × interval) segundos do vídeo e o resto fica sem imagem fresca (descompasso com a narração).
- `criarVideo()` já calcula via `calcularIntervalImagens(duration, count)` — transparente pro agente.
- Valores corretos por duração (quando usando os defaults de `DURACOES_VALIDAS`):
  - `30-segundos` + 5 imgs → interval 6s
  - `45-segundos` + 5 imgs → interval 9s
  - `1-minuto` + 10 imgs → interval 6s
  - `2-minutos` + 10 imgs → interval 12s
  - `3-minutos` + 15 imgs → interval 12s
  - `5-minutos` + 20 imgs → interval 15s
  - `12-minutos` + 35 imgs → interval ~21s
- Se o usuário reclamar que "imagens ficam fora de sincronia" ou "as últimas imagens repetem/congelam", é porque o cálculo falhou ou foi sobrescrito por valor errado.

## Instruções visuais (auto_images_instructions)
- **Gerado dinamicamente pelo Claude** (via `gerarInstrucoesVisuais(tema, roteiro)` em `server/chat.js`) para cada vídeo — NÃO é mais template carimbado.
- Formato: parágrafo único em PORTUGUÊS, 4-7 frases, descrevendo ambiente/iluminação/elementos/paleta/atmosfera, com elementos CONCRETOS do roteiro (ex: "espelho embaçado", "porta lacrada").
- `criarVideo()` valida que o campo tem >= 50 chars.
- Se o usuário reclamar que "imagens não batem com a fala", confirmar que a função `gerarInstrucoesVisuais` está rodando (procurar log "🎨 Gerando instruções visuais..."). Template antigo gerava prompts idênticos.

## Roteiros — cuidado com "CENA X:"
O SYSTEM_PROMPT instrui gerar "CENA 0:, CENA 1:" pro usuário ver estrutura no chat. Porém: se o `script_text` passado pra API ainda tiver "CENA X:", o TTS lê literal ("cena zero, cena um") em voz alta. O extrator do servidor deve remover esses prefixos antes do POST. Se o usuário reclamar de ouvir "CENA ZERO" na narração, é esse bug.

## Intercepts de diagnóstico TikTok (2026-04-24)
Dois comandos no chat exclusivamente pra operador, úteis pra gravar o vídeo de demonstração na submissão do app TikTok. Ambos rodam no TOPO de `processarComando` — ANTES de `parseComandoPostarManual` — senão "posta direto" casaria com o regex `/^posta\s+(.+)/`.

- **Status da conta TikTok** — frases `verificar tiktok`, `status tiktok`, `conectar tiktok`, `tiktok conectado`, `minha conta tiktok`, `info tiktok` → chama `tiktok.buscarInfoContaTikTok()` (`GET /v2/user/info/`) e responde com Nome / @username / Open ID + linha explícita `⏳ video.publish: aguardando aprovação do app`.
- **Teste do escopo Direct Post** — frases `posta direto`, `publica direto`, `direct post`, `postar direto`, `publicar direto`, `video.publish` → chama `tiktok.testarDirectPost()` (`POST /v2/post/publish/video/init/`) e responde com bloco "📱 Direct Post TikTok — integração implementada. A API retornou: [erro exato]. Este escopo ficará ativo após aprovação do app pelo TikTok. O fluxo técnico está completo e funcional."
- Match por `.includes()` (não exato) — frases completas como "quero verificar tiktok agora" também disparam.
- Nenhum conflita com `detectarAprovacaoPostagem` (que usa match exato).

## Não fazer
- Não mandar `voice_provider: 'darkflow_voices'` direto no POST (causa VALIDATION_VOICE_INVALID em certos paths — usar `'darkvi'`).
- Não fazer PATCH em card travado pra "forçar retry" — o worker não re-executa. Sempre criar card novo via `criarVideo()`.
- Não sugerir deletar cards manualmente — o backend do DarkFlow faz housekeeping e purga cards recentes sozinho (confirmado 2026-04-23).
