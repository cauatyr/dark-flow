#!/usr/bin/env node
require('dotenv').config()

const { uploadYoutube } = require('../api/youtube_api')

const videoPath = process.argv[2]
const titulo    = process.argv[3]
const descricao = process.argv[4]

if (!videoPath || !titulo) {
  console.error('Uso: node scripts/upload-youtube.js <caminho-video.mp4> "<titulo>" "[descricao opcional]"')
  process.exit(1)
}

;(async () => {
  try {
    const link = await uploadYoutube(videoPath, titulo, descricao)
    console.log('\n✅ Sucesso!')
    console.log(`📺 ${link}`)
  } catch (err) {
    console.error(`\n❌ Erro: ${err.message}`)
    process.exit(1)
  }
})()
