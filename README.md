# pbcjs

Motore open source per giochi di ruolo "play by chat" via browser. Backend Node.js + Fastify, frontend Vue 3, database PostgreSQL.

Design: [`docs/superpowers/specs/2026-10-27-pbcjs-foundation-design.md`](docs/superpowers/specs/2026-10-27-pbcjs-foundation-design.md)

## Requisiti

- Node.js 22 o superiore (`.nvmrc`)
- pnpm 11 (`corepack enable`)
- Docker con Compose

## Sviluppo

```bash
cp .env.example .env
pnpm install
pnpm db:up        # avvia Postgres in Docker
pnpm dev          # API su :3000, frontend su :5173
```

Apri http://localhost:5173.

| Comando                                                            | Cosa fa                                                                |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `pnpm test`                                                        | test di tutti i package (i test `*.int.test.ts` richiedono Docker)     |
| `pnpm typecheck`                                                   | controllo dei tipi                                                     |
| `pnpm lint`                                                        | ESLint e Stylelint su tutto il progetto                                |
| `pnpm build`                                                       | build di API e frontend                                                |
| `pnpm db:down`                                                     | ferma Postgres                                                         |
| `pnpm --filter @pbcjs/api exec drizzle-kit generate --name <nome>` | genera una migrazione dopo aver modificato `apps/api/src/db/schema.ts` |

## Avvio con Docker

```bash
cp .env.example .env   # imposta POSTGRES_PASSWORD (solo lettere e numeri)
docker compose -f docker/compose.yml --env-file .env up -d --build
```

L'app è su http://localhost:3000 (porta configurabile con `APP_PORT`). Le migrazioni del database vengono eseguite all'avvio.

Smoke test dell'immagine: `./scripts/docker-smoke.sh`.

## Struttura

- `apps/api`: API Fastify, serve anche il frontend in produzione
- `apps/web`: frontend Vue 3
- `packages/shared`: schemi e tipi condivisi
- `docker/`: Dockerfile e file Compose
