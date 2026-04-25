# CRITICAL — Fluxo de upload TikTok

## Endpoint
`POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/`

## Fluxo (arquivo único, sem chunks)
1. Verificar/renovar access token.
2. POST init com `source_info: { source: "FILE_UPLOAD", video_size, chunk_size: video_size, total_chunk_count: 1 }`.
3. Receber `upload_url` e `publish_id`.
4. PUT do arquivo binário no `upload_url` com headers:
   - `Content-Type: video/mp4`
   - `Content-Range: bytes 0-{size-1}/{size}`
5. Vídeo aparece no inbox do app TikTok.

## Notificação obrigatória
"📱 TikTok: enviado para inbox — publique pelo app"

## NUNCA
- Marcar como postado se PUT falhar
- Tentar `/publish/video/init/` (requer scope não disponível)
- Hardcodear access_token (sempre via `getAccessTokenTikTok()`)
