const fs = require('fs')
const { google } = require('googleapis')

const DEFAULT_TAGS = ['historiadeterror', 'terror', 'medo', 'creepy', 'sussurrosnaescuridao']
const DEFAULT_CATEGORY_ID = '22'
const DEFAULT_PRIVACY = 'public'
const DEFAULT_LANGUAGE = 'pt'
const DEFAULT_DESCRIPTION = 'Uma história de terror perturbadora. Se inscreva para mais!'

let cachedOAuth2 = null

function getOAuth2Client() {
  if (cachedOAuth2) return cachedOAuth2

  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN

  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET precisam estar no .env')
  }
  if (!refreshToken) {
    throw new Error(
      'YOUTUBE_REFRESH_TOKEN não configurado no .env. Gere via gerarAuthUrl() + trocarCodigoPorToken(code).'
    )
  }

  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth/youtube/callback'
  )
  oauth2.setCredentials({ refresh_token: refreshToken })

  cachedOAuth2 = oauth2
  return oauth2
}

async function getYoutubeToken() {
  const oauth2 = getOAuth2Client()
  const { token } = await oauth2.getAccessToken()
  if (!token) throw new Error('Falha ao obter access token do YouTube')
  return token
}

function gerarAuthUrl() {
  const oauth2 = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth/youtube/callback'
  )
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/youtube.upload']
  })
}

async function trocarCodigoPorToken(code) {
  const oauth2 = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth/youtube/callback'
  )
  const { tokens } = await oauth2.getToken(code)
  return tokens
}

async function uploadYoutube(videoPath, titulo, descricao, opts = {}) {
  if (!videoPath) throw new Error('videoPath obrigatório')
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Arquivo de vídeo não encontrado: ${videoPath}`)
  }
  if (!titulo || !titulo.trim()) throw new Error('Título obrigatório')

  await getYoutubeToken()

  const auth = getOAuth2Client()
  const youtube = google.youtube({ version: 'v3', auth })

  const stats = fs.statSync(videoPath)
  console.log(`📺 Upload YouTube: ${titulo} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`)

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: titulo,
        description: descricao || DEFAULT_DESCRIPTION,
        tags: opts.tags || DEFAULT_TAGS,
        categoryId: opts.categoryId || DEFAULT_CATEGORY_ID,
        defaultLanguage: opts.defaultLanguage || DEFAULT_LANGUAGE,
        defaultAudioLanguage: opts.defaultAudioLanguage || DEFAULT_LANGUAGE
      },
      status: {
        privacyStatus: opts.privacyStatus || DEFAULT_PRIVACY,
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: fs.createReadStream(videoPath)
    }
  }, {
    onUploadProgress: evt => {
      const pct = stats.size ? ((evt.bytesRead / stats.size) * 100).toFixed(1) : '?'
      process.stdout.write(`\r   ⬆️  ${pct}% (${(evt.bytesRead / 1024 / 1024).toFixed(1)} MB)`)
    }
  })

  process.stdout.write('\n')

  const videoId = response.data.id
  if (!videoId) throw new Error('Upload bem-sucedido mas sem videoId na resposta')
  const link = `https://youtube.com/watch?v=${videoId}`
  console.log(`✅ YouTube: ${link}`)
  return link
}

module.exports = {
  uploadYoutube,
  uploadVideo: uploadYoutube,
  getYoutubeToken,
  gerarAuthUrl,
  trocarCodigoPorToken
}
