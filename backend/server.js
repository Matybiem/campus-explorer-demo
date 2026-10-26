import { app } from './app.js'

const port = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un puerto válido entre 1 y 65535.')
}

app.listen(port, () => {
  console.log(`Campus Explorer API disponible en http://localhost:${port}`)
})
