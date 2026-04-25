# CRITICAL — Regras absolutas de automação DarkFlow

LEIA ANTES DE QUALQUER AÇÃO.

## Autenticação
- SEMPRE usar `api/auth-darkflow.js` → `getValidAccessToken()`. NUNCA cookies, NUNCA o velho `server/auth.js` (deletado).
- Fluxo: lê `config/credentials.json` → decode JWT → se access_token < 60s de expirar, chama refresh; se refresh falhar, faz login completo via Playwright (`loginAutomatico`).
- O refresh token MUDA a cada renovação — `salvarCredentials()` reescreve `config/credentials.json` imediatamente.
- Credenciais de login (EMAIL/PASSWORD) estão hardcoded em `api/auth-darkflow.js` (decisão de automação total sem intervenção manual).
- `config/credentials.json` está no `.gitignore`. Nunca commitar.
- Para reprovisionar manualmente: `node scripts/get-initial-token.js`.

## Criação de vídeos
- SEMPRE via API direta (POST /rest/v1/video_cards). NUNCA pelo wizard.
- Confirmar status 201 antes de declarar sucesso.
- IMEDIATAMENTE após criar, mover para `gerar-roteiro` com PATCH (status 200).
- Salvar o ID em `memory/videos-criados-por-mim.json`.
- Ativar o monitor de 50 minutos automaticamente.

### Campos obrigatórios do POST (revalidados contra POST real da UI em 2026-04-22 via spy Playwright)
- `theme` (título), `theme_type: 'roteiro_pronto'`, `status: 'videos-a-fazer'`
- `duration` (ex: `'30-segundos'`, `'3-minutos'`, `'12-minutos'`), `duration_type` (`'tiktok'` ou `'longo'`)
- `script_text`, `language: 'pt-BR'` (NUNCA `'pt'`)
- **Voz:** `voice` (voiceId retornado por `elevenlabs-list-voices`; o campo `voice_id` não existe na tabela), `voice_name`, `voice_provider: 'elevenlabs'` ou `'darkvi'`. **Descoberto em 2026-04-23:** o backend NORMALIZA `'darkvi'` → grava como `'darkflow_voices'` na row. Valor canônico na tabela é `'darkflow_voices'`, mas no POST continuamos mandando `'darkvi'` (a sessão 6 confirmou que `'darkflow_voices'` direto no POST ainda dá VALIDATION_VOICE_INVALID em alguns paths). Para DarkVI, o `voice` deve ser UUID (ex: `cfefb4d6-f863-47ba-a1a4-ef8178410da7` = Ronald). Para ElevenLabs, alfanumérico.
- `auto_subtitles: true`, `subtitle_color: 'Amarelo'`
- `auto_images_count` (múltiplo de 5), `auto_images_instructions`, `visual_images_mode: 'auto_outline'`, `auto_images_provider: 'h200'`
- `background_music` (URL do bucket `avatars`), `user_id`
- **NÃO mandar:** `ai_provider` / `ai_model` — o backend preenche com `'google'` / `'gemini-2.0-flash-exp'` automaticamente. Também **não mandar** `source_page` — o backend preenche (UI real não envia).

## Voz
- SEMPRE selecionar via `api/voice-selector.js` → `selecionarVoz(roteiro)`. NUNCA hardcodear voice_id.
- Fonte: edge function **`POST /functions/v1/elevenlabs-list-voices`** com body `{"language":"pt"}`. Retorna lista já filtrada no mesmo caminho usado pela UI do DarkFlow. Response: `{voices: [{voiceId, name, previewUrl, category, language, gender, description, labels}]}`.
- O campo do POST em `video_cards` é **`voice`** (não `voice_id`), valor = `voiceId` da edge function.
- **`voice_provider` tem valores específicos**: `'elevenlabs'` OU `'darkvi'`. **NUNCA** `'darkflow_voices'` — esse valor era chute inventado e causa `VALIDATION_VOICE_INVALID` no TTS. Por padrão o voice-selector retorna `'elevenlabs'`.
- A escolha é baseada no roteiro: `analisarRoteiro()` classifica em `atmosferico|psicologico|intimo|cotidiano` + `curta|longa`, e `escolherMelhorVoz()` pontua cada voz por regex em `nome+description+category+gender`. Penaliza termos festivos/comerciais (`cheerful|playful|cartoon|noel|sales|retail|advertisement`).
- Tabela legada `max_tts_voices` **não é usada pelo DarkFlow** — evitar. A tabela real que a UI consulta é `voice_catalog` (com coluna `provider` = `elevenlabs` ou `darkvi`), mas como a edge function já consolida, usa-se ela.
- **Ronald voltou como fallback quando ElevenLabs está fora** (2026-04-23): ElevenLabs entrou em manutenção / bateu fila 50/50 (429). Fallback manual foi `voice_provider: 'darkvi'` + `voice: 'cfefb4d6-f863-47ba-a1a4-ef8178410da7'` (Ronald, UUID DarkVI) + `voice_name: 'Ronald'`. Funcionou: pipeline rodou até `concluido`. Em fluxo automático a voz continua dinâmica; manual só quando ElevenLabs cair.
- **DarkVI catálogo vive em `voice_catalog?provider=eq.darkvi`** — 182 vozes sem `language`/`gender` tags (todos null). Seleção só pelo `name`. Vozes PT-BR claras: Ronald, Escarlate, `Lutor - misterioso`, `Luiz - night radio`, `Pedro - calm voice`, Tiago, `Tio wil`, `Vlogger dramático`, `Vendedora 2`, Marcia, Milena. Timbres de terror multilíngues: `Deep Secret`, `Deadpan Goth`, `Soothing Narrator`, `Evil Genius`, `Classy Witch`, `Demonic Orc`.
- `api/darkflow_api.js` **não tem mais** `buscarVoiceId` nem `buscarVoiceIdPlaywright` — foram removidos. Só chame via `voice-selector`.

## Música
- Bucket é `avatars`. NUNCA `audio` (não existe).
- Upload via `darkflow_api.uploadMusicaBucket(caminho)`.
- Arquivo padrão: `audio/trilha-padrao.mp3`.

## Imagens
- Quantidade SEMPRE múltiplo de 5 (5, 10, 15, 20, 25, 30, 35, 40).
- Prompts em INGLÊS, baseados no roteiro, não genéricos.
- Cada prompt: tipo de plano + sujeito + ação + cenário + iluminação + atmosfera + estilo + paleta.
- Evitar: rostos claros, cores quentes, cenas felizes.
- **`auto_images_interval` TEM QUE cobrir toda a duração**: `interval = round(duracao_segundos / count)`. O DarkFlow distribui as imagens LITERALMENTE — se interval=5 × count=10, só cobre 50s. `criarVideo()` calcula automático via `calcularIntervalImagens(duration, count)` ✅ RESOLVIDO (2026-04-23).
- **Instruções visuais dinâmicas**: `server/chat.js:gerarInstrucoesVisuais(tema, roteiro)` chama Claude pra gerar parágrafo único com elementos concretos do roteiro + regras de imagens perturbadoras ✅ RESOLVIDO (2026-04-23).
- ⚠️ **Sincronização semântica ainda imperfeita**: `visual_images_mode: 'auto_outline'` distribui por tempo, não por conteúdo falado. `transcription_segments` fica `[]`. Pra sincronização frase-a-frase, pendente descobrir via spy se existe modo `transcription-synced` ou populando `image_segments` manualmente.

## Legenda
- SEMPRE `auto_subtitles: true` e `subtitle_color: "Amarelo"`.
- ✅ **RESOLVIDO (2026-04-23)**: burn-in da legenda no MP4 exige `subtitle_settings` populado com 15 campos (cor `#FFFF00`, fontSize 50, position bottom, captionStyle `tiktok-center`, outline, etc.). `criarVideo()` agora envia esse objeto por default e valida `enabled===true`. Descoberto comparando cards antigos que tinham legenda (2f21bebb, 06aa61b9 etc.) com os novos sem legenda.
- Se usuário pedir estilo diferente: ajustar `fontSize`, `position`, `displayMode: 'word-by-word'` (+ `wordsPerDisplay: 3`, `motionEffect: true`).

## Roteiros
- Verificar contagem de caracteres ANTES de criar.
- Faixas em `server/chat.js` (DURACOES_VALIDAS).
- Estrutura obrigatória: gancho → tensão crescente → plot twist → final impactante.
- ⚠️ **NUNCA colocar marcadores tipo `CENA 0:`, `CENA 1:`, `[CENA]`, `---` ou qualquer label estrutural dentro de `script_text`**. O TTS lê LITERAL — narrador vai falar "cena zero" em voz alta. Marcadores de cena são só organizadores internos (usados mentalmente pra construir `auto_images_instructions`). `script_text` deve conter SÓ o que o narrador fala, parágrafos separados por `\n\n`.
- Também evitar no `script_text`: aspas simples/tipográficas mal fechadas, emojis, footers de UI tipo "Digite 'aprovado'..." (herdado de um mock do chat — TTS lê isso também).
- Reproduzido no card `68af52a5-0f44-4f68-80b4-9747af01f959` (2026-04-23): `script_text` começava com "CENA 0: Alguém mora no porão...". Ronald narrou "CENA ZERO" em voz alta. Erro 100% evitável na fonte.

## Aprovação
- SEMPRE aguardar aprovação explícita do usuário antes de criar.
- Palavras de aprovação: aprovado, ok, sim, cria, vai, yes, criar, manda, beleza.

## Upload YouTube/TikTok — REMOVIDO em 2026-04-24
Sistema **NÃO posta em lugar nenhum automaticamente**. Quando vídeo conclui, notifica no chat e user baixa/posta manualmente pelo DarkFlow. **NÃO reintroduzir upload sem pedido explícito — decisão informada do user.**

- Fluxo atual: card → `concluido + download_url` → `scripts/monitor-videos.js` (Realtime watcher + cron 50min) marca `pronto:true, notificado:true` em `videos-criados-por-mim.json` → uma notificação WebSocket: `"✅ **[título]** está pronto! 🎬 Acesse o DarkFlow para baixar e publicar."`
- Cron 50min CONTINUA RODANDO sempre — ativado no boot se há cards `!pronto`. Permite detectar vídeos prontos mesmo sem user abrir DarkFlow.
- Arquivos órfãos mantidos no repo mas sem chamador: `api/youtube_api.js`, `scripts/upload-youtube.js`, `scripts/upload-tiktok.js`, `scripts/youtube-oauth.js`, `scripts/tiktok-oauth.js`.
- `api/tiktok_api.js` MANTIDO — os intercepts de chat `verificar tiktok` (`GET /v2/user/info/`) e `posta direto` (`POST /v2/post/publish/video/init/`) ainda usam `testarDirectPost()` e `buscarInfoContaTikTok()` pra diagnóstico de submissão do app. Essas funções ficam; só `uploadTikTok()` fica sem chamador.
- `memory/pendente-postagem.json` — não é mais gerado nem lido. Apagar do disco se existir.
- Flags `dispensado` e `aguardar_confirmacao` em `videos-criados-por-mim.json` são legado, ignoradas pelo código atual.

## Cron Monitor
- EXATAMENTE 50 minutos (`*/50 * * * *`). Não menos.
- Ativar ao criar vídeo. Desativar quando fila vazia.
- Notifica todos os usuários conectados via WebSocket quando vídeo termina.

## Erros conhecidos
- VALIDATION_VOICE_INVALID → buscar voice_id dinâmico
- HTTP 400 trilha → bucket errado (use `avatars`)
- Card não aparece → POST não retornou 201
- Card fica em "VÍDEOS A FAZER" → faltou PATCH para `gerar-roteiro`
