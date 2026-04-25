const { loginAutomatico } = require('../api/auth-darkflow')

;(async () => {
  try {
    console.log('🎬 Buscando token inicial do DarkFlow via Playwright...')
    await loginAutomatico()
    console.log('✅ credentials.json populado em config/credentials.json')
    process.exit(0)
  } catch (err) {
    console.error('❌ Falhou:', err.message)
    console.error(err.stack)
    process.exit(1)
  }
})()
