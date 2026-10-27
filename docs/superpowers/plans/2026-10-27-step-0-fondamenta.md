# Step 0 — Fondamenta: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo pnpm funzionante con API Fastify (healthcheck con stato DB), shell Vue con token del tema di default, Drizzle + Postgres con migrazioni automatiche, immagine Docker unica e CI.

**Architecture:** Monolite modulare (spec §3). `packages/shared` espone schemi TypeBox come sorgente TS (nessuna build: lo consumano tsx, Vite, Vitest e il bundle tsup dell'API). `apps/api` è bundlato con tsup e in produzione serve anche il frontend compilato. Un'immagine Docker contiene API, migrazioni e frontend.

**Tech Stack:** Node 22, pnpm 11 workspaces, TypeScript strict, Fastify 5, `@fastify/type-provider-typebox` 5, `@sinclair/typebox` 0.34, Drizzle ORM 0.44 + drizzle-kit 0.31, `pg` 8, Vue 3.5, Vue Router 4, vue-i18n 11, Vite 7, Vitest 3, Testcontainers 11, ESLint 9 (flat), Prettier 3, Stylelint 16, Husky 9 + lint-staged 16, Docker, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-27-pbcjs-foundation-design.md`

## Global Constraints

- Node: `>=22.12`; `.nvmrc` = `22`; immagine Docker `node:22-alpine`.
- Package manager: `pnpm@11.9.0` (campo `packageManager`).
- Database: PostgreSQL 17 (`postgres:17-alpine`), ORM Drizzle, migrazioni versionate in `apps/api/drizzle/`, solo in avanti, eseguite all'avvio.
- Variabili d'ambiente solo per infrastruttura e segreti; configurazione di gioco nel DB (tabella `settings`).
- I componenti Vue usano solo CSS variables `--pbc-*`; colori fissi ammessi solo in `apps/web/src/theme/`.
- Tutti i testi dell'interfaccia passano da vue-i18n; italiano lingua base, inglese seconda.
- Classi CSS pubbliche con prefisso `pbc-` in formato BEM (`pbc-blocco__elemento--modificatore`).
- Lint locale sempre e solo sui file modificati (es. `pnpm exec eslint <file>`), mai sull'intero progetto. La CI esegue il lint completo.
- Prettier: `semi: false`, `singleQuote: true`, `printWidth: 100`.
- Commit in formato conventional commits; ogni messaggio termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

```
pbcjs/
├─ package.json                  script root, devDeps lint/format
├─ pnpm-workspace.yaml           workspace + injectWorkspacePackages
├─ .nvmrc, .editorconfig, .gitignore, .prettierrc.json, .prettierignore
├─ tsconfig.base.json            opzioni TS condivise
├─ eslint.config.js              ESLint flat config (TS + Vue + Prettier)
├─ stylelint.config.mjs          divieto colori fissi fuori da src/theme
├─ .env.example                  variabili per sviluppo e compose
├─ .dockerignore
├─ .husky/pre-commit             lint-staged
├─ .github/workflows/ci.yml      lint, typecheck, test, build, smoke Docker
├─ README.md                     avvio sviluppo e Docker
├─ scripts/docker-smoke.sh       smoke test dell'immagine
├─ docker/
│  ├─ Dockerfile                 build multi-stage
│  ├─ compose.yml                app + postgres
│  └─ compose.dev.yml            solo postgres per lo sviluppo
├─ packages/shared/
│  ├─ package.json, tsconfig.json
│  ├─ src/index.ts               barrel
│  ├─ src/health.ts              schema HealthResponse
│  └─ test/health.test.ts
├─ apps/api/
│  ├─ package.json, tsconfig.json, tsup.config.ts, vitest.config.ts, drizzle.config.ts
│  ├─ drizzle/                   migrazioni generate
│  ├─ src/config.ts              parsing e validazione env
│  ├─ src/app.ts                 buildApp(config, deps)
│  ├─ src/server.ts              entry: config → db → migrazioni → listen
│  ├─ src/plugins/web-static.ts  frontend statico + fallback SPA
│  ├─ src/modules/health/routes.ts
│  ├─ src/db/schema.ts           tabella settings
│  ├─ src/db/client.ts           createDb(url) → DbHandle
│  ├─ src/db/migrate.ts          runMigrations(db, dir)
│  └─ test/{helpers.ts, config.test.ts, health.test.ts, web-static.test.ts, db.int.test.ts}
└─ apps/web/
   ├─ package.json, tsconfig.json, vite.config.ts, index.html
   ├─ src/main.ts, src/App.vue, src/router.ts
   ├─ src/i18n/{index.ts, it.ts, en.ts}
   ├─ src/theme/tokens.css       token del tema default (unico posto con colori fissi)
   ├─ src/styles/base.css        stili base basati sui token
   ├─ src/layouts/DefaultLayout.vue
   ├─ src/pages/{HomePage.vue, NotFoundPage.vue}
   └─ src/features/health/{api.ts, HealthStatus.vue, HealthStatus.test.ts}
```

---

### Task 1: Scaffolding del monorepo e strumenti di qualità

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `.gitignore`, `.prettierrc.json`, `.prettierignore`, `tsconfig.base.json`, `eslint.config.js`, `stylelint.config.mjs`

**Interfaces:**
- Produces: script root `lint`, `typecheck`, `test`, `build`, `dev`, `db:up`, `db:down`, `format`; `tsconfig.base.json` esteso da tutti i package.

- [ ] **Step 1: Crea i file di configurazione root**

`package.json`:
```json
{
  "name": "pbcjs",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.9.0",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "dev": "pnpm -r --parallel --filter \"./apps/*\" dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint . && stylelint \"**/*.{css,vue}\"",
    "format": "prettier --write .",
    "db:up": "docker compose -f docker/compose.dev.yml --env-file .env up -d",
    "db:down": "docker compose -f docker/compose.dev.yml --env-file .env down"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
injectWorkspacePackages: true
onlyBuiltDependencies:
  - esbuild
```

`.nvmrc`:
```
22
```

`.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

`.gitignore`:
```
node_modules/
dist/
coverage/
.env
*.log
```

`.prettierrc.json`:
```json
{ "semi": false, "singleQuote": true, "printWidth": 100 }
```

`.prettierignore`:
```
dist
coverage
pnpm-lock.yaml
apps/api/drizzle
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`eslint.config.js`:
```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', 'apps/api/drizzle/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
)
```

`stylelint.config.mjs`:
```js
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-recommended-vue'],
  ignoreFiles: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch'],
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
      { message: 'Use BEM: pbc-block__element--modifier' },
    ],
  },
  overrides: [
    {
      files: ['apps/web/src/theme/**/*.css'],
      rules: { 'color-no-hex': null, 'color-named': null, 'function-disallowed-list': null },
    },
  ],
}
```

- [ ] **Step 2: Installa le dipendenze di sviluppo root**

Run:
```bash
pnpm add -Dw typescript@~5.9 @types/node@^22 eslint@^9 @eslint/js@^9 typescript-eslint@^8 eslint-plugin-vue@^10 eslint-config-prettier@^10 globals@^16 prettier@^3 stylelint@^16 stylelint-config-standard@^39 stylelint-config-recommended-vue@^1 postcss-html@^1
```
Expected: `pnpm-lock.yaml` creato, nessun errore. Se pnpm segnala build script ignorati, esegui `pnpm approve-builds` e approva solo `esbuild`.

- [ ] **Step 3: Verifica che la regola sui colori fissi funzioni**

Run:
```bash
mkdir -p apps/web/src/tmp && printf '.pbc-x { color: #fff; }\n' > apps/web/src/tmp/bad.css
pnpm exec stylelint apps/web/src/tmp/bad.css; echo "exit=$?"
rm -rf apps/web/src/tmp
```
Expected: errore `color-no-hex` ed `exit=2`.

Run:
```bash
mkdir -p apps/web/src/theme && printf ':root { --pbc-x: #fff; }\n' > apps/web/src/theme/probe.css
pnpm exec stylelint apps/web/src/theme/probe.css; echo "exit=$?"
rm apps/web/src/theme/probe.css
```
Expected: nessun errore, `exit=0` (override per `src/theme`).

- [ ] **Step 4: Verifica ESLint sul config stesso**

Run: `pnpm exec eslint eslint.config.js stylelint.config.mjs`
Expected: nessun output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .nvmrc .editorconfig .gitignore .prettierrc.json .prettierignore tsconfig.base.json eslint.config.js stylelint.config.mjs
git commit -m "chore: scaffold pnpm monorepo with lint and format tooling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `packages/shared` con schema HealthResponse

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/src/health.ts`
- Test: `packages/shared/test/health.test.ts`

**Interfaces:**
- Produces: `import { HealthResponse } from '@pbcjs/shared'` — schema TypeBox e tipo omonimo `{ status: 'ok' | 'degraded'; db: 'ok' | 'down'; version: string }`.

- [ ] **Step 1: Crea il package**

`packages/shared/package.json`:
```json
{
  "name": "@pbcjs/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Run: `pnpm --filter @pbcjs/shared add @sinclair/typebox@^0.34 && pnpm --filter @pbcjs/shared add -D vitest@^3`

- [ ] **Step 2: Scrivi il test che fallisce**

`packages/shared/test/health.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { Value } from '@sinclair/typebox/value'
import { HealthResponse } from '../src/index'

describe('HealthResponse', () => {
  it('accepts a healthy payload', () => {
    expect(Value.Check(HealthResponse, { status: 'ok', db: 'ok', version: '1.0.0' })).toBe(true)
  })

  it('accepts a degraded payload', () => {
    expect(Value.Check(HealthResponse, { status: 'degraded', db: 'down', version: '1.0.0' })).toBe(
      true,
    )
  })

  it('rejects unknown status values', () => {
    expect(Value.Check(HealthResponse, { status: 'broken', db: 'ok', version: '1.0.0' })).toBe(
      false,
    )
  })

  it('rejects a missing version', () => {
    expect(Value.Check(HealthResponse, { status: 'ok', db: 'ok' })).toBe(false)
  })
})
```

- [ ] **Step 3: Esegui il test e verifica che fallisca**

Run: `pnpm --filter @pbcjs/shared test`
Expected: FAIL, `Failed to resolve import "../src/index"`.

- [ ] **Step 4: Implementa lo schema**

`packages/shared/src/health.ts`:
```ts
import { Type, type Static } from '@sinclair/typebox'

export const HealthResponse = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degraded')]),
  db: Type.Union([Type.Literal('ok'), Type.Literal('down')]),
  version: Type.String(),
})

export type HealthResponse = Static<typeof HealthResponse>
```

`packages/shared/src/index.ts`:
```ts
export * from './health'
```

- [ ] **Step 5: Esegui test e typecheck**

Run: `pnpm --filter @pbcjs/shared test && pnpm --filter @pbcjs/shared typecheck`
Expected: 4 test PASS, typecheck senza errori.

- [ ] **Step 6: Lint dei file modificati**

Run: `pnpm exec eslint packages/shared/src/health.ts packages/shared/src/index.ts packages/shared/test/health.test.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add HealthResponse schema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: API Fastify con config e healthcheck

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/config.ts`, `apps/api/src/app.ts`, `apps/api/src/modules/health/routes.ts`
- Test: `apps/api/test/helpers.ts`, `apps/api/test/config.test.ts`, `apps/api/test/health.test.ts`

**Interfaces:**
- Consumes: `HealthResponse` da `@pbcjs/shared`.
- Produces:
  - `interface AppConfig { port: number; host: string; databaseUrl: string; logLevel: LogLevel; appVersion: string; webDistDir?: string; migrationsDir: string }`
  - `loadConfig(env: Record<string, string | undefined>): AppConfig` — lancia `Error('Invalid environment: ...')` se non valido.
  - `interface AppDeps { checkDb: () => Promise<boolean> }`
  - `buildApp(config: AppConfig, deps: AppDeps)` → `Promise<FastifyInstance>` (con type provider TypeBox), già pronta per `inject`/`listen`.
  - `GET /api/health` → 200 `{status:'ok',db:'ok',version}` oppure 503 `{status:'degraded',db:'down',version}`.
  - `testConfig(overrides?: Partial<AppConfig>): AppConfig` in `test/helpers.ts`.

- [ ] **Step 1: Crea il package**

`apps/api/package.json`:
```json
{
  "name": "@pbcjs/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "files": ["dist", "drizzle"],
  "scripts": {
    "dev": "tsx watch --env-file=../../.env src/server.ts",
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "*.config.ts"]
}
```

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 10_000,
  },
})
```

Run:
```bash
pnpm --filter @pbcjs/api add fastify@^5 @fastify/type-provider-typebox@^5 @sinclair/typebox@^0.34
pnpm --filter @pbcjs/api add -D @pbcjs/shared@workspace:* vitest@^3 tsx@^4
```

- [ ] **Step 2: Scrivi i test della config che falliscono**

`apps/api/test/config.test.ts`:
```ts
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'

const base = { DATABASE_URL: 'postgres://pbc:pw@localhost:5432/pbc' }

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base)
    expect(config).toEqual({
      port: 3000,
      host: '127.0.0.1',
      databaseUrl: base.DATABASE_URL,
      logLevel: 'info',
      appVersion: '0.0.0-dev',
      webDistDir: undefined,
      migrationsDir: path.resolve('drizzle'),
    })
  })

  it('converts and maps provided values', () => {
    const config = loadConfig({
      ...base,
      PORT: '8080',
      HOST: '0.0.0.0',
      LOG_LEVEL: 'debug',
      APP_VERSION: '1.2.3',
      WEB_DIST_DIR: '/app/public',
      MIGRATIONS_DIR: '/app/drizzle',
    })
    expect(config.port).toBe(8080)
    expect(config.host).toBe('0.0.0.0')
    expect(config.logLevel).toBe('debug')
    expect(config.appVersion).toBe('1.2.3')
    expect(config.webDistDir).toBe('/app/public')
    expect(config.migrationsDir).toBe('/app/drizzle')
  })

  it('treats empty strings as missing', () => {
    expect(loadConfig({ ...base, PORT: '' }).port).toBe(3000)
  })

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/Invalid environment: .*DATABASE_URL/)
  })

  it('throws on an invalid port', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/)
  })

  it('throws on an unknown log level', () => {
    expect(() => loadConfig({ ...base, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/)
  })
})
```

- [ ] **Step 3: Esegui i test e verifica che falliscano**

Run: `pnpm --filter @pbcjs/api test`
Expected: FAIL, `Failed to resolve import "../src/config"`.

- [ ] **Step 4: Implementa la config**

`apps/api/src/config.ts`:
```ts
import path from 'node:path'
import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

const EnvSchema = Type.Object({
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  HOST: Type.String({ default: '127.0.0.1' }),
  DATABASE_URL: Type.String({ minLength: 1 }),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal('fatal'),
      Type.Literal('error'),
      Type.Literal('warn'),
      Type.Literal('info'),
      Type.Literal('debug'),
      Type.Literal('trace'),
      Type.Literal('silent'),
    ],
    { default: 'info' },
  ),
  APP_VERSION: Type.String({ default: '0.0.0-dev' }),
  WEB_DIST_DIR: Type.Optional(Type.String({ minLength: 1 })),
  MIGRATIONS_DIR: Type.String({ default: 'drizzle' }),
})

type Env = Static<typeof EnvSchema>

export type LogLevel = Env['LOG_LEVEL']

export interface AppConfig {
  port: number
  host: string
  databaseUrl: string
  logLevel: LogLevel
  appVersion: string
  webDistDir?: string
  migrationsDir: string
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const known: Record<string, string> = {}
  for (const key of Object.keys(EnvSchema.properties)) {
    const value = env[key]
    if (value !== undefined && value !== '') known[key] = value
  }

  const input = Value.Convert(EnvSchema, Value.Default(EnvSchema, known))
  if (!Value.Check(EnvSchema, input)) {
    const details = [...Value.Errors(EnvSchema, input)]
      .map((error) => `${error.path.slice(1) || '(root)'} ${error.message}`)
      .join('; ')
    throw new Error(`Invalid environment: ${details}`)
  }

  const parsed: Env = input
  return {
    port: parsed.PORT,
    host: parsed.HOST,
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    appVersion: parsed.APP_VERSION,
    webDistDir: parsed.WEB_DIST_DIR,
    migrationsDir: path.resolve(parsed.MIGRATIONS_DIR),
  }
}
```

Nota: un `DATABASE_URL` mancante produce l'errore `DATABASE_URL Expected required property`, quindi il messaggio contiene il nome della variabile.

- [ ] **Step 5: Esegui i test della config**

Run: `pnpm --filter @pbcjs/api test -- test/config.test.ts`
Expected: 6 test PASS.

- [ ] **Step 6: Scrivi helper e test del healthcheck che falliscono**

`apps/api/test/helpers.ts`:
```ts
import type { AppConfig } from '../src/config'

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    databaseUrl: 'postgres://unused:unused@127.0.0.1:1/unused',
    logLevel: 'silent',
    appVersion: '1.2.3',
    migrationsDir: 'drizzle',
    ...overrides,
  }
}
```

`apps/api/test/health.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { testConfig } from './helpers'

let app: FastifyInstance | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('GET /api/health', () => {
  it('returns 200 when the database is reachable', async () => {
    app = await buildApp(testConfig(), { checkDb: async () => true })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', db: 'ok', version: '1.2.3' })
  })

  it('returns 503 when the database is down', async () => {
    app = await buildApp(testConfig(), { checkDb: async () => false })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'degraded', db: 'down', version: '1.2.3' })
  })

  it('returns 503 when the database check throws', async () => {
    app = await buildApp(testConfig(), {
      checkDb: async () => {
        throw new Error('boom')
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ db: 'down' })
  })
})
```

- [ ] **Step 7: Esegui i test e verifica che falliscano**

Run: `pnpm --filter @pbcjs/api test -- test/health.test.ts`
Expected: FAIL, `Failed to resolve import "../src/app"`.

- [ ] **Step 8: Implementa route e app**

`apps/api/src/modules/health/routes.ts`:
```ts
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { HealthResponse } from '@pbcjs/shared'

export interface HealthRoutesOptions {
  checkDb: () => Promise<boolean>
  version: string
}

export const healthRoutes: FastifyPluginAsyncTypebox<HealthRoutesOptions> = async (app, opts) => {
  app.get(
    '/health',
    { schema: { response: { 200: HealthResponse, 503: HealthResponse } } },
    async (_request, reply) => {
      const dbOk = await opts.checkDb().catch(() => false)
      return reply.code(dbOk ? 200 : 503).send({
        status: dbOk ? 'ok' : 'degraded',
        db: dbOk ? 'ok' : 'down',
        version: opts.version,
      })
    },
  )
}
```

`apps/api/src/app.ts`:
```ts
import Fastify from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { AppConfig } from './config'
import { healthRoutes } from './modules/health/routes'

export interface AppDeps {
  checkDb: () => Promise<boolean>
}

export async function buildApp(config: AppConfig, deps: AppDeps) {
  const app = Fastify({ logger: { level: config.logLevel } }).withTypeProvider<TypeBoxTypeProvider>()

  await app.register(healthRoutes, {
    prefix: '/api',
    checkDb: deps.checkDb,
    version: config.appVersion,
  })

  await app.ready()
  return app
}
```

- [ ] **Step 9: Esegui test e typecheck**

Run: `pnpm --filter @pbcjs/api test && pnpm --filter @pbcjs/api typecheck`
Expected: 9 test PASS, typecheck senza errori.

- [ ] **Step 10: Lint dei file modificati**

Run: `pnpm exec eslint apps/api/src/config.ts apps/api/src/app.ts apps/api/src/modules/health/routes.ts apps/api/test/helpers.ts apps/api/test/config.test.ts apps/api/test/health.test.ts apps/api/vitest.config.ts`
Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add Fastify app with env config and health endpoint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Database (Drizzle + Postgres), migrazioni ed entry del server

**Files:**
- Create: `apps/api/drizzle.config.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/server.ts`, `apps/api/tsup.config.ts`, `apps/api/drizzle/*` (generati), `docker/compose.dev.yml`, `.env.example`
- Test: `apps/api/test/db.int.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `buildApp`, `AppConfig` (Task 3); `testConfig` (Task 3).
- Produces:
  - `settings` (tabella Drizzle: `key text pk`, `value jsonb not null`, `updated_at timestamptz not null default now()`).
  - `type Db = NodePgDatabase<typeof schema>`
  - `interface DbHandle { db: Db; ping: () => Promise<boolean>; close: () => Promise<void> }`
  - `createDb(url: string, onError?: (err: Error) => void): DbHandle`
  - `runMigrations(db: Db, migrationsFolder: string): Promise<void>`
  - `dist/server.js` (bundle tsup) come entry di produzione.

- [ ] **Step 1: Installa le dipendenze**

Run:
```bash
pnpm --filter @pbcjs/api add drizzle-orm@^0.44 pg@^8
pnpm --filter @pbcjs/api add -D drizzle-kit@^0.31 @types/pg@^8 @testcontainers/postgresql@^11 tsup@^8
```

- [ ] **Step 2: Scrivi il test di integrazione che fallisce**

`apps/api/test/db.int.test.ts`:
```ts
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { createDb, type DbHandle } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { settings } from '../src/db/schema'
import { buildApp } from '../src/app'
import { testConfig } from './helpers'

let container: StartedPostgreSqlContainer
let handle: DbHandle

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start()
  handle = createDb(container.getConnectionUri())
  await runMigrations(handle.db, path.resolve(import.meta.dirname, '../drizzle'))
}, 120_000)

afterAll(async () => {
  await handle?.close()
  await container?.stop()
})

describe('database', () => {
  it('creates the settings table', async () => {
    await handle.db.insert(settings).values({ key: 'game.name', value: 'Test Game' })
    const rows = await handle.db.select().from(settings)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'game.name', value: 'Test Game' })
    expect(rows[0]?.updatedAt).toBeInstanceOf(Date)
  })

  it('is idempotent when migrations run twice', async () => {
    await expect(
      runMigrations(handle.db, path.resolve(import.meta.dirname, '../drizzle')),
    ).resolves.toBeUndefined()
  })

  it('ping returns true for a reachable database', async () => {
    expect(await handle.ping()).toBe(true)
  })

  it('ping returns false for an unreachable database', async () => {
    const unreachable = createDb('postgres://x:y@127.0.0.1:1/z')
    expect(await unreachable.ping()).toBe(false)
    await unreachable.close()
  })

  it('health endpoint reports the real database as ok', async () => {
    const app = await buildApp(testConfig(), { checkDb: handle.ping })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', db: 'ok' })
    await app.close()
  })
})
```

- [ ] **Step 3: Esegui il test e verifica che fallisca**

Run: `pnpm --filter @pbcjs/api test -- test/db.int.test.ts`
Expected: FAIL, `Failed to resolve import "../src/db/client"`. Docker deve essere attivo.

- [ ] **Step 4: Implementa schema, client e migrazioni**

`apps/api/src/db/schema.ts`:
```ts
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

`apps/api/src/db/client.ts`:
```ts
import pg from 'pg'
import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>

export interface DbHandle {
  db: Db
  ping: () => Promise<boolean>
  close: () => Promise<void>
}

export function createDb(url: string, onError?: (err: Error) => void): DbHandle {
  const pool = new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5_000 })
  pool.on('error', (err) => onError?.(err))
  const db = drizzle(pool, { schema })

  return {
    db,
    ping: async () => {
      try {
        await db.execute(sql`select 1`)
        return true
      } catch {
        return false
      }
    },
    close: () => pool.end(),
  }
}
```

`apps/api/src/db/migrate.ts`:
```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Db } from './client'

export async function runMigrations(db: Db, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder })
}
```

`apps/api/drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
```

- [ ] **Step 5: Genera la prima migrazione**

Run: `pnpm --filter @pbcjs/api exec drizzle-kit generate --name init`
Expected: creati `apps/api/drizzle/0000_init.sql` (contiene `CREATE TABLE "settings"`) e `apps/api/drizzle/meta/_journal.json`.

- [ ] **Step 6: Esegui il test di integrazione**

Run: `pnpm --filter @pbcjs/api test -- test/db.int.test.ts`
Expected: 5 test PASS.

- [ ] **Step 7: Crea entry del server, bundle e ambiente di sviluppo**

`apps/api/src/server.ts`:
```ts
import { loadConfig } from './config'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import { buildApp } from './app'

const config = loadConfig(process.env)
const handle = createDb(config.databaseUrl, (err) => console.error('postgres pool error', err))
await runMigrations(handle.db, config.migrationsDir)
const app = await buildApp(config, { checkDb: handle.ping })

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await handle.close()
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

await app.listen({ port: config.port, host: config.host })
```

`apps/api/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: true,
  noExternal: [/^@pbcjs\//],
})
```

`docker/compose.dev.yml`:
```yaml
name: pbcjs-dev
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: pbc
      POSTGRES_DB: pbc
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
    ports:
      - '5432:5432'
    volumes:
      - pgdata-dev:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U pbc -d pbc']
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  pgdata-dev: {}
```

`.env.example`:
```bash
# Password del database: usa solo lettere e numeri (finisce dentro DATABASE_URL)
POSTGRES_PASSWORD=changeme

# Solo sviluppo locale (in Docker DATABASE_URL viene composto da compose.yml)
DATABASE_URL=postgres://pbc:changeme@localhost:5432/pbc
PORT=3000
HOST=127.0.0.1
LOG_LEVEL=info

# Porta pubblicata da docker/compose.yml
APP_PORT=3000
```

- [ ] **Step 8: Verifica manuale del server in sviluppo**

Run:
```bash
cp .env.example .env
pnpm db:up
```
In un secondo terminale: `pnpm --filter @pbcjs/api dev`. Poi:
```bash
curl -s http://127.0.0.1:3000/api/health; echo
```
Expected: `{"status":"ok","db":"ok","version":"0.0.0-dev"}`. Ferma il server con Ctrl+C.

- [ ] **Step 9: Verifica build e typecheck**

Run: `pnpm --filter @pbcjs/api build && pnpm --filter @pbcjs/api typecheck && ls apps/api/dist`
Expected: `server.js` e `server.js.map` presenti, nessun errore.

- [ ] **Step 10: Lint dei file modificati**

Run: `pnpm exec eslint apps/api/src/db/schema.ts apps/api/src/db/client.ts apps/api/src/db/migrate.ts apps/api/src/server.ts apps/api/drizzle.config.ts apps/api/tsup.config.ts apps/api/test/db.int.test.ts`
Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add apps/api docker/compose.dev.yml .env.example pnpm-lock.yaml
git commit -m "feat(api): add Postgres with Drizzle migrations and server entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Shell Vue con token del tema e i18n

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.ts`, `apps/web/src/App.vue`, `apps/web/src/router.ts`, `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/it.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/theme/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/layouts/DefaultLayout.vue`, `apps/web/src/pages/HomePage.vue`, `apps/web/src/pages/NotFoundPage.vue`, `apps/web/src/features/health/api.ts`, `apps/web/src/features/health/HealthStatus.vue`
- Test: `apps/web/src/features/health/HealthStatus.test.ts`

**Interfaces:**
- Consumes: tipo `HealthResponse` da `@pbcjs/shared`; `GET /api/health` (Task 3).
- Produces:
  - `fetchHealth(): Promise<HealthResponse>` — risolve con 200 e 503, lancia per gli altri status o per un errore di rete.
  - `i18n` (istanza vue-i18n, `legacy: false`, locale `it`).
  - Token CSS: `--pbc-color-bg`, `--pbc-color-surface`, `--pbc-color-text`, `--pbc-color-text-muted`, `--pbc-color-primary`, `--pbc-color-danger`, `--pbc-color-chat-action`, `--pbc-color-chat-master`, `--pbc-font-body`, `--pbc-font-heading`, `--pbc-font-chat`, `--pbc-radius-base`, `--pbc-space-1..4`.
  - Classi pubbliche: `.pbc-layout`, `.pbc-layout__header`, `.pbc-layout__main`, `.pbc-layout__footer`, `.pbc-health`, `.pbc-health--down`.
  - `vite build` produce `apps/web/dist/index.html` con `<div id="app"></div>`.

- [ ] **Step 1: Crea il package**

`apps/web/package.json`:
```json
{
  "name": "@pbcjs/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "test": "vitest run",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "jsx": "preserve"
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  test: {
    environment: 'jsdom',
  },
})
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>pbcjs</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Run:
```bash
pnpm --filter @pbcjs/web add vue@^3.5 vue-router@^4 vue-i18n@^11
pnpm --filter @pbcjs/web add -D @pbcjs/shared@workspace:* vite@^7 @vitejs/plugin-vue@^6 vue-tsc@^3 vitest@^3 @vue/test-utils@^2 jsdom@^26
```

- [ ] **Step 2: Crea i18n e token del tema**

`apps/web/src/i18n/it.ts`:
```ts
export default {
  app: {
    title: 'pbcjs',
    subtitle: 'Motore per giochi di ruolo play by chat',
  },
  health: {
    checking: 'Verifica del server…',
    unreachable: 'Server non raggiungibile',
    status: 'Server: {status} · DB: {db} · v{version}',
  },
  notFound: {
    title: 'Pagina non trovata',
    back: 'Torna alla home',
  },
}
```

`apps/web/src/i18n/en.ts`:
```ts
import type it from './it'

const en: typeof it = {
  app: {
    title: 'pbcjs',
    subtitle: 'Play by chat role-playing engine',
  },
  health: {
    checking: 'Checking server…',
    unreachable: 'Server unreachable',
    status: 'Server: {status} · DB: {db} · v{version}',
  },
  notFound: {
    title: 'Page not found',
    back: 'Back to home',
  },
}

export default en
```

`apps/web/src/i18n/index.ts`:
```ts
import { createI18n } from 'vue-i18n'
import it from './it'
import en from './en'

export const i18n = createI18n({
  legacy: false,
  locale: 'it',
  fallbackLocale: 'it',
  messages: { it, en },
})
```

`apps/web/src/theme/tokens.css`:
```css
:root {
  --pbc-color-bg: #16181d;
  --pbc-color-surface: #20232b;
  --pbc-color-text: #e6e6e6;
  --pbc-color-text-muted: #9aa0ab;
  --pbc-color-primary: #c9a227;
  --pbc-color-danger: #e0605e;
  --pbc-color-chat-action: #d9b46c;
  --pbc-color-chat-master: #8fb3d9;
  --pbc-font-body: system-ui, -apple-system, 'Segoe UI', roboto, sans-serif;
  --pbc-font-heading: georgia, 'Times New Roman', serif;
  --pbc-font-chat: var(--pbc-font-body);
  --pbc-radius-base: 6px;
  --pbc-space-1: 0.25rem;
  --pbc-space-2: 0.5rem;
  --pbc-space-3: 1rem;
  --pbc-space-4: 2rem;
}
```

`apps/web/src/styles/base.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--pbc-color-bg);
  color: var(--pbc-color-text);
  font-family: var(--pbc-font-body);
  line-height: 1.5;
}

h1,
h2,
h3 {
  font-family: var(--pbc-font-heading);
}

a {
  color: var(--pbc-color-primary);
}
```

- [ ] **Step 3: Scrivi il test di HealthStatus che fallisce**

`apps/web/src/features/health/HealthStatus.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { i18n } from '../../i18n'
import HealthStatus from './HealthStatus.vue'

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

async function render() {
  const wrapper = mount(HealthStatus, { global: { plugins: [i18n] } })
  await flushPromises()
  return wrapper.get('[data-testid="health"]')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HealthStatus', () => {
  it('shows a healthy server', async () => {
    mockFetch(200, { status: 'ok', db: 'ok', version: '1.2.3' })
    const el = await render()
    expect(el.text()).toBe('Server: ok · DB: ok · v1.2.3')
    expect(el.classes()).not.toContain('pbc-health--down')
  })

  it('marks a degraded server', async () => {
    mockFetch(503, { status: 'degraded', db: 'down', version: '1.2.3' })
    const el = await render()
    expect(el.text()).toBe('Server: degraded · DB: down · v1.2.3')
    expect(el.classes()).toContain('pbc-health--down')
  })

  it('shows an error when the server is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    const el = await render()
    expect(el.text()).toBe('Server non raggiungibile')
    expect(el.classes()).toContain('pbc-health--down')
  })

  it('shows an error on unexpected status codes', async () => {
    mockFetch(500, { message: 'boom' })
    const el = await render()
    expect(el.text()).toBe('Server non raggiungibile')
  })
})
```

- [ ] **Step 4: Esegui il test e verifica che fallisca**

Run: `pnpm --filter @pbcjs/web test`
Expected: FAIL, `Failed to resolve import "./HealthStatus.vue"`.

- [ ] **Step 5: Implementa client API e componente**

`apps/web/src/features/health/api.ts`:
```ts
import type { HealthResponse } from '@pbcjs/shared'

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health')
  if (res.status !== 200 && res.status !== 503) {
    throw new Error(`Unexpected status ${res.status}`)
  }
  return (await res.json()) as HealthResponse
}
```

`apps/web/src/features/health/HealthStatus.vue`:
```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HealthResponse } from '@pbcjs/shared'
import { fetchHealth } from './api'

const { t } = useI18n()
const health = ref<HealthResponse | null>(null)
const failed = ref(false)

onMounted(async () => {
  try {
    health.value = await fetchHealth()
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <p v-if="failed" class="pbc-health pbc-health--down" data-testid="health">
    {{ t('health.unreachable') }}
  </p>
  <p
    v-else-if="health"
    class="pbc-health"
    :class="{ 'pbc-health--down': health.status !== 'ok' }"
    data-testid="health"
  >
    {{ t('health.status', { status: health.status, db: health.db, version: health.version }) }}
  </p>
  <p v-else class="pbc-health" data-testid="health">{{ t('health.checking') }}</p>
</template>

<style scoped>
.pbc-health {
  margin: 0;
  color: var(--pbc-color-text-muted);
  font-size: 0.875rem;
}

.pbc-health--down {
  color: var(--pbc-color-danger);
}
</style>
```

- [ ] **Step 6: Esegui il test**

Run: `pnpm --filter @pbcjs/web test`
Expected: 4 test PASS.

- [ ] **Step 7: Crea layout, pagine, router ed entry**

`apps/web/src/layouts/DefaultLayout.vue`:
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import HealthStatus from '../features/health/HealthStatus.vue'

const { t } = useI18n()
</script>

<template>
  <div class="pbc-layout">
    <header class="pbc-layout__header">
      <RouterLink to="/">{{ t('app.title') }}</RouterLink>
    </header>
    <main class="pbc-layout__main">
      <slot />
    </main>
    <footer class="pbc-layout__footer">
      <HealthStatus />
    </footer>
  </div>
</template>

<style scoped>
.pbc-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.pbc-layout__header,
.pbc-layout__footer {
  padding: var(--pbc-space-2) var(--pbc-space-3);
  background: var(--pbc-color-surface);
}

.pbc-layout__header {
  font-family: var(--pbc-font-heading);
  font-size: 1.25rem;
}

.pbc-layout__main {
  flex: 1;
  padding: var(--pbc-space-4) var(--pbc-space-3);
}
</style>
```

`apps/web/src/pages/HomePage.vue`:
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="pbc-home">
    <h1>{{ t('app.title') }}</h1>
    <p>{{ t('app.subtitle') }}</p>
  </section>
</template>
```

`apps/web/src/pages/NotFoundPage.vue`:
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="pbc-not-found">
    <h1>{{ t('notFound.title') }}</h1>
    <RouterLink to="/">{{ t('notFound.back') }}</RouterLink>
  </section>
</template>
```

`apps/web/src/router.ts`:
```ts
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./pages/NotFoundPage.vue'),
    },
  ],
})
```

`apps/web/src/App.vue`:
```vue
<script setup lang="ts">
import DefaultLayout from './layouts/DefaultLayout.vue'
</script>

<template>
  <DefaultLayout>
    <RouterView />
  </DefaultLayout>
</template>
```

`apps/web/src/main.ts`:
```ts
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import './theme/tokens.css'
import './styles/base.css'

createApp(App).use(router).use(i18n).mount('#app')
```

- [ ] **Step 8: Verifica build, typecheck e avvio**

Run: `pnpm --filter @pbcjs/web build && grep -c '<div id="app"></div>' apps/web/dist/index.html`
Expected: build completata, output `1`.

Verifica manuale (con Postgres e API attivi come nel Task 4 Step 8): `pnpm dev`, apri `http://localhost:5173`. Expected: header "pbcjs", titolo e sottotitolo, footer "Server: ok · DB: ok · v0.0.0-dev"; `http://localhost:5173/xyz` mostra "Pagina non trovata".

- [ ] **Step 9: Lint dei file modificati**

Run:
```bash
pnpm exec eslint apps/web/vite.config.ts apps/web/src/main.ts apps/web/src/App.vue apps/web/src/router.ts apps/web/src/i18n/index.ts apps/web/src/i18n/it.ts apps/web/src/i18n/en.ts apps/web/src/layouts/DefaultLayout.vue apps/web/src/pages/HomePage.vue apps/web/src/pages/NotFoundPage.vue apps/web/src/features/health/api.ts apps/web/src/features/health/HealthStatus.vue apps/web/src/features/health/HealthStatus.test.ts
pnpm exec stylelint apps/web/src/theme/tokens.css apps/web/src/styles/base.css apps/web/src/layouts/DefaultLayout.vue apps/web/src/features/health/HealthStatus.vue
```
Expected: exit 0 per entrambi.

- [ ] **Step 10: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add Vue shell with theme tokens, i18n and health status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: L'API serve il frontend con fallback SPA

**Files:**
- Create: `apps/api/src/plugins/web-static.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/web-static.test.ts`

**Interfaces:**
- Consumes: `buildApp`, `AppConfig.webDistDir` (Task 3).
- Produces: plugin `webStatic` (`fastify-plugin`, opzioni `{ root: string }`). Con `webDistDir` impostato: file statici serviti dalla root; `GET` di percorsi sconosciuti fuori da `/api` e `/ws` → `index.html`; tutto il resto → 404 `{ code: 'NOT_FOUND', message: 'Route not found' }`.

- [ ] **Step 1: Installa le dipendenze**

Run: `pnpm --filter @pbcjs/api add @fastify/static@^8 fastify-plugin@^5`

- [ ] **Step 2: Scrivi il test che fallisce**

`apps/api/test/web-static.test.ts`:
```ts
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { testConfig } from './helpers'

let dir: string
let app: FastifyInstance

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'pbc-web-'))
  await mkdir(path.join(dir, 'assets'))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><div id="app"></div>')
  await writeFile(path.join(dir, 'assets', 'app.js'), 'console.log("app")')
  app = await buildApp(testConfig({ webDistDir: dir }), { checkDb: async () => true })
})

afterAll(async () => {
  await app.close()
  await rm(dir, { recursive: true, force: true })
})

describe('web static serving', () => {
  it('serves index.html at the root', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<div id="app"></div>')
  })

  it('serves static assets', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/app.js' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('javascript')
  })

  it('falls back to index.html for client-side routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/characters/42' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<div id="app"></div>')
  })

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Route not found' })
  })

  it('returns a JSON 404 for non-GET unknown routes', async () => {
    const res = await app.inject({ method: 'POST', url: '/characters/42' })
    expect(res.statusCode).toBe(404)
  })

  it('keeps the API working', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
  })
})
```

- [ ] **Step 3: Esegui il test e verifica che fallisca**

Run: `pnpm --filter @pbcjs/api test -- test/web-static.test.ts`
Expected: FAIL, `GET /` risponde 404.

- [ ] **Step 4: Implementa il plugin**

`apps/api/src/plugins/web-static.ts`:
```ts
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
```

Modifica `apps/api/src/app.ts` — sostituisci il contenuto con:
```ts
import Fastify from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { AppConfig } from './config'
import { healthRoutes } from './modules/health/routes'
import { webStatic } from './plugins/web-static'

export interface AppDeps {
  checkDb: () => Promise<boolean>
}

export async function buildApp(config: AppConfig, deps: AppDeps) {
  const app = Fastify({ logger: { level: config.logLevel } }).withTypeProvider<TypeBoxTypeProvider>()

  await app.register(healthRoutes, {
    prefix: '/api',
    checkDb: deps.checkDb,
    version: config.appVersion,
  })

  if (config.webDistDir) {
    await app.register(webStatic, { root: config.webDistDir })
  }

  await app.ready()
  return app
}
```

- [ ] **Step 5: Esegui tutti i test dell'API e il typecheck**

Run: `pnpm --filter @pbcjs/api test && pnpm --filter @pbcjs/api typecheck`
Expected: tutti i test PASS (config, health, db, web-static), typecheck senza errori.

- [ ] **Step 6: Lint dei file modificati**

Run: `pnpm exec eslint apps/api/src/plugins/web-static.ts apps/api/src/app.ts apps/api/test/web-static.test.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): serve built frontend with SPA fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Immagine Docker, compose e smoke test

**Files:**
- Create: `docker/Dockerfile`, `docker/compose.yml`, `.dockerignore`, `scripts/docker-smoke.sh`

**Interfaces:**
- Consumes: `pnpm --filter @pbcjs/web build` → `apps/web/dist`; `pnpm --filter @pbcjs/api build` → `apps/api/dist/server.js`; `apps/api/drizzle`; variabili `WEB_DIST_DIR`, `MIGRATIONS_DIR`, `DATABASE_URL`, `APP_VERSION` (Task 3).
- Produces: immagine con `/app/dist/server.js`, `/app/drizzle`, `/app/public`, volume `/app/data` scrivibile dall'utente `node`; `scripts/docker-smoke.sh` (exit 0 = ok), usato dalla CI.

- [ ] **Step 1: Scrivi lo smoke test**

`scripts/docker-smoke.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export POSTGRES_PASSWORD=smoketest
export APP_PORT=3999
COMPOSE=(docker compose -f docker/compose.yml -p pbcjs-smoke)
BASE="http://127.0.0.1:${APP_PORT}"

cleanup() { "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

"${COMPOSE[@]}" up -d --build

body=""
for _ in $(seq 1 60); do
  if body=$(curl -fsS "${BASE}/api/health" 2>/dev/null); then break; fi
  sleep 1
done

if ! grep -q '"db":"ok"' <<<"${body}"; then
  echo "FAIL health: ${body:-no response}"
  "${COMPOSE[@]}" logs app
  exit 1
fi

curl -fsS "${BASE}/" | grep -q '<div id="app"></div>' || { echo "FAIL index"; exit 1; }
curl -fsS "${BASE}/some/client/route" | grep -q '<div id="app"></div>' || { echo "FAIL spa fallback"; exit 1; }

echo "smoke ok: ${body}"
```

Run: `chmod +x scripts/docker-smoke.sh && ./scripts/docker-smoke.sh; echo "exit=$?"`
Expected: FAIL (`docker/compose.yml` mancante), exit diverso da 0.

- [ ] **Step 2: Crea Dockerfile, compose e .dockerignore**

`.dockerignore`:
```
**/node_modules
**/dist
**/coverage
.git
.env
.husky
docs
```

`docker/Dockerfile`:
```dockerfile
FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    HUSKY=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @pbcjs/web build \
  && pnpm --filter @pbcjs/api build \
  && pnpm --filter @pbcjs/api deploy --prod /out

FROM node:22-alpine
ARG APP_VERSION=0.0.0-dev
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION} \
    WEB_DIST_DIR=/app/public \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app

COPY --from=build /out ./
COPY --from=build /repo/apps/web/dist ./public
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/server.js"]
```

`docker/compose.yml`:
```yaml
name: pbcjs
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: pbc
      POSTGRES_DB: pbc
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U pbc -d pbc']
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    image: pbcjs:local
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://pbc:${POSTGRES_PASSWORD}@postgres:5432/pbc
      LOG_LEVEL: ${LOG_LEVEL:-info}
    ports:
      - '${APP_PORT:-3000}:3000'
    volumes:
      - data:/app/data
    restart: unless-stopped

volumes:
  pgdata: {}
  data: {}
```

- [ ] **Step 3: Esegui lo smoke test**

Run: `./scripts/docker-smoke.sh; echo "exit=$?"`
Expected: ultima riga `smoke ok: {"status":"ok","db":"ok","version":"0.0.0-dev"}` ed `exit=0`.

Se `pnpm deploy` fallisce perché manca `dist` in `/out`, verifica che `apps/api/package.json` abbia `"files": ["dist", "drizzle"]` (Task 3 Step 1).

- [ ] **Step 4: Verifica che l'app giri come utente non root**

Run: `docker run --rm --entrypoint id pbcjs:local`
Expected: `uid=1000(node) gid=1000(node)`.

- [ ] **Step 5: Commit**

```bash
git add docker/Dockerfile docker/compose.yml .dockerignore scripts/docker-smoke.sh
git commit -m "build: add Docker image, compose stack and smoke test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: CI, hook pre-commit e README

**Files:**
- Create: `.github/workflows/ci.yml`, `.husky/pre-commit`, `README.md`
- Modify: `package.json` (script `prepare`, blocco `lint-staged`)

**Interfaces:**
- Consumes: script root `lint`, `typecheck`, `test`, `build` (Task 1); `scripts/docker-smoke.sh` (Task 7).
- Produces: workflow `CI` con job `check` e `docker-smoke`; hook pre-commit che esegue lint e format solo sui file in staging.

- [ ] **Step 1: Installa husky e lint-staged**

Run:
```bash
pnpm add -Dw husky@^9 lint-staged@^16
pnpm exec husky init
```
Expected: creati `.husky/pre-commit` e lo script `"prepare": "husky"` in `package.json`.

- [ ] **Step 2: Configura hook e lint-staged**

`.husky/pre-commit` (sostituisci il contenuto):
```sh
pnpm exec lint-staged
```

Aggiungi a `package.json` (al livello di `scripts`):
```json
"lint-staged": {
  "*.{ts,js,mjs,vue}": ["eslint --fix", "prettier --write"],
  "*.{css,vue}": ["stylelint --fix"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

- [ ] **Step 3: Verifica che l'hook blocchi un errore**

Run:
```bash
printf 'const unused = 1\n' > packages/shared/src/probe.ts
git add packages/shared/src/probe.ts
git commit -m "test: probe"; echo "exit=$?"
git restore --staged packages/shared/src/probe.ts && rm packages/shared/src/probe.ts
```
Expected: errore ESLint `@typescript-eslint/no-unused-vars`, commit rifiutato, exit diverso da 0.

- [ ] **Step 4: Crea il workflow CI**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

  docker-smoke:
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/docker-smoke.sh
```

- [ ] **Step 5: Scrivi il README**

`README.md`:
````markdown
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

| Comando | Cosa fa |
|---|---|
| `pnpm test` | test di tutti i package (i test `*.int.test.ts` richiedono Docker) |
| `pnpm typecheck` | controllo dei tipi |
| `pnpm lint` | ESLint e Stylelint su tutto il progetto |
| `pnpm build` | build di API e frontend |
| `pnpm db:down` | ferma Postgres |
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
````

- [ ] **Step 6: Esegui localmente gli stessi controlli della CI**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: tutti i comandi terminano con exit 0.

Nota: il workflow GitHub non può essere verificato finché il repository non ha un remote su GitHub. Questo step è l'equivalente locale.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml .husky/pre-commit README.md package.json pnpm-lock.yaml
git commit -m "ci: add GitHub Actions workflow, pre-commit hook and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: l'hook pre-commit gira su `package.json` e `README.md` e il commit va a buon fine.

---

## Definition of Done (Step 0)

- `./scripts/docker-smoke.sh` termina con `smoke ok`.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passa da clone pulito.
- `pnpm dev` mostra la shell Vue con lo stato del server nel footer.
- Le migrazioni Drizzle girano all'avvio e creano la tabella `settings`.
