import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'

export interface WebStaticOptions {
  root: string
}

export const webStatic = fp<WebStaticOptions>(async (app, opts) => {
  await app.register(fastifyStatic, { root: opts.root, wildcard: false })

  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url.startsWith('/api') || request.url.startsWith('/ws')
    if (request.method !== 'GET' || isApi) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: 'Route not found' })
    }
    return reply.sendFile('index.html')
  })
})
