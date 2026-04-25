#!/usr/bin/env node
require('dotenv').config()

const { uploadTikTok } = require('../api/tiktok_api')

const videoPath = process.argv[2]
const titulo    = process.argv[3]

if (!videoPath || !titulo) {
  console.error('Uso: node scripts/upload-tiktok.js <caminho-video.mp4> "<titulo>"')
  process.exit(1)
}

;(async () => {
  try {
    const result = await uploadTikTok(videoPath, titulo)
    if (result.sandbox) {
      console.log('\n⚠️  TikTok em modo sandbox — upload simulado.')
      console.log('    ' + result.mensagem)
    } else {
      console.log('\n✅ Enviado para inbox do TikTok')
      console.log(`📱 publish_id: ${result.publish_id}`)
      console.log('   Abra o TikTok no celular > Inbox > publique manualmente.')
    }
  } catch (err) {
    console.error(`\n❌ Erro: ${err.message}`)
    process.exit(1)
  }
})()
