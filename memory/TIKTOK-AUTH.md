# TikTok — Credenciais e Renovação

## Arquivo de tokens
Caminho: `tiktok-tokens.json` (raiz do projeto)

Estrutura:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 86400,
  "refresh_expires_in": 31536000,
  "open_id": "-000cMA_laeECJm5HrPdpVk1yMm4-6AW9UvR",
  "client_key": "sbaw63pv9quvx62xp8",
  "client_secret": "...",
  "created_at": 1740000000000
}
```

## Renovação automática
- `api/tiktok_api.js` verifica `created_at + expires_in` antes de cada upload.
- Se faltam menos de 5 minutos, renova via `oauth/token/` com `grant_type=refresh_token`.
- Salva os novos tokens automaticamente.

## Limitações do sandbox
- Scope `video.publish` não está disponível.
- Vídeos vão para INBOX, não publicam direto.
- Para publicar: TikTok no celular > Inbox > publicar manualmente.

## Como obter tokens iniciais
1. Crie um app sandbox em https://developers.tiktok.com
2. Configure scopes: `user.info.basic`, `video.upload`, `video.list`
3. Faça o fluxo OAuth e capture access + refresh tokens
4. Salve no `tiktok-tokens.json` com `created_at: Date.now()`
