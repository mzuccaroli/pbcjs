# Step 1b — `packages/theme`: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Libreria `@pbcjs/theme` (schema e validazione di `theme.json`, merge con il tema `default`, generazione delle CSS variables, sanitizzazione di `custom.css`) e tema `default` come fonte unica dei token, da cui `pnpm theme:build` genera `apps/web/src/theme/tokens.css`.

**Architecture:** Package solo sorgente come `@pbcjs/shared`. Un file per responsabilità: `schema.ts` (TypeBox + pattern), `validate.ts`, `merge.ts`, `css-vars.ts`, `sanitize.ts` (postcss + postcss-value-parser), `errors.ts`. Lo script `scripts/build-default.ts` (tsx) usa le stesse funzioni di un modulo `scripts/default-tokens.ts`, condiviso con il test di sincronizzazione.

**Tech Stack:** TypeScript strict, `@sinclair/typebox` 0.34, postcss 8, postcss-value-parser 4, Vitest 3, tsx 4.

**Spec:** `docs/superpowers/specs/2026-10-28-step-1-dice-theme-design.md` §3, §4, §5, §6.

## Global Constraints

- Node `>=22.12`; package manager `pnpm@11.9.0`.
- Package solo sorgente: `"exports": { ".": "./src/index.ts" }`, script `test` (`vitest run`) e `typecheck` (`tsc -p tsconfig.json`). Nessuno script `build` (lo script del generatore si chiama `build:default`).
- Dipendenze di `@pbcjs/theme`: `@sinclair/typebox` (stessa versione di `@pbcjs/shared`, `^0.34.52`), `postcss`, `postcss-value-parser`. DevDependencies: `vitest` (`^3.2.7`), `tsx` (`^4.23.15`).
- Installazione dipendenze sempre con `--config.minimum-release-age=1440` (policy pnpm di 1 giorno; nessun override nel repo).
- Schema `theme.json`:
  - `id` `^[a-z0-9][a-z0-9-]{0,62}$`; `name` da 1 a 80 caratteri; `version` semver.
  - `tokens` con categorie opzionali `color`, `font`, `radius`, `space`, `image`.
  - `layout` e `components` riservati: accettati con qualsiasi valore e ignorati.
  - Chiavi dei token `^[a-z0-9][a-z0-9-]*$`.
- Valori ammessi:
  - `color`: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()`/`hsl()`/`hsla()` con argomenti numerici (anche `%` e `deg`).
  - `font`: solo `[A-Za-z0-9 ,'"-]`.
  - `radius` e `space`: `0` oppure numero con `px`, `rem`, `em`, `%`.
  - `image`: percorso relativo sotto `assets/`, senza `..` né `/` iniziale, estensioni `png`, `jpg`, `jpeg`, `webp`, `gif`, `avif`, `svg`.
- Variabili CSS: `--pbc-<categoria>-<chiave>`. Ordine delle categorie fisso: color, font, radius, space, image. Dentro una categoria vale l'ordine delle proprietà JS: chiavi numeriche prima, in ordine crescente, poi le altre in ordine di inserimento.
- Header esatto di `tokens.css`: `/* Generated from themes/default/theme.json by pnpm theme:build — do not edit */`.
- `sanitizeCustomCss` rimuove: `@import`; `url()` assoluti (`http:`, `https:`, `//`, qualsiasi schema tranne `data:image/*`); dichiarazioni con `\` nel valore o nel nome; `expression()`; proprietà `behavior` e `-moz-binding`. CSS non parsabile → `ThemeError` con codice `THEME_CSS_INVALID`.
- Colori fissi ammessi solo in `apps/web/src/theme/` (regola stylelint esistente).
- Prettier: `semi: false`, `singleQuote: true`, `printWidth: 100`.
- Lint locale solo sui file modificati (`pnpm exec eslint <file>`, `pnpm exec stylelint <file>`), mai sull'intero progetto, salvo la verifica finale prevista dal Task 3.
- Commit in formato conventional commits, **senza** trailer `Co-Authored-By` né altre attribuzioni a Claude: i commit risultano solo a nome dell'autore.

## File Structure

```
packages/theme/
├─ package.json             @pbcjs/theme, script test/typecheck/build:default
├─ tsconfig.json            estende tsconfig.base.json; include src, test, scripts
├─ src/
│  ├─ schema.ts             pattern, ThemeManifest, ThemeTokens, TOKEN_CATEGORIES
│  ├─ validate.ts           validateTheme()
│  ├─ merge.ts              mergeWithDefault()
│  ├─ css-vars.ts           toCssVariables()
│  ├─ sanitize.ts           sanitizeCustomCss()
│  ├─ errors.ts             ThemeError
│  └─ index.ts              export pubblici
├─ scripts/
│  ├─ default-tokens.ts     percorsi, header, renderDefaultTokensCss()
│  └─ build-default.ts      scrive apps/web/src/theme/tokens.css
└─ test/
   ├─ validate.test.ts
   ├─ merge.test.ts
   ├─ css-vars.test.ts
   ├─ default-theme.test.ts
   └─ sanitize.test.ts
themes/default/theme.json   tema default, fonte unica dei token
apps/web/src/theme/tokens.css   generato (non modificare a mano)
package.json (root)         script theme:build
```

---

### Task 1: Scaffolding, schema e `validateTheme`

**Files:**

- Create: `packages/theme/package.json`, `packages/theme/tsconfig.json`
- Create: `packages/theme/src/schema.ts`, `packages/theme/src/validate.ts`, `packages/theme/src/index.ts`
- Create: `packages/theme/test/validate.test.ts`
- Modify: `pnpm-lock.yaml` (via `pnpm add`)

**Interfaces:**

- Consumes: niente.
- Produces:
  - `const ThemeTokens` (schema TypeBox) e `type ThemeTokens = { color?: Record<string, string>; font?: ...; radius?: ...; space?: ...; image?: ... }`
  - `const ThemeManifest` (schema) e `type ThemeManifest = { id: string; name: string; version: string; tokens: ThemeTokens; layout?: unknown; components?: unknown }`
  - `type TokenCategory = 'color' | 'font' | 'radius' | 'space' | 'image'`; `const TOKEN_CATEGORIES: readonly TokenCategory[]` nell'ordine color, font, radius, space, image
  - `validateTheme(json: unknown): ValidateThemeResult` con `type ValidateThemeResult = { ok: true; theme: ThemeManifest } | { ok: false; errors: ThemeValidationError[] }` e `interface ThemeValidationError { path: string; message: string }` (path JSON-pointer, es. `/tokens/color/bg`)

- [ ] **Step 1: Crea il package**

`packages/theme/package.json`:

```json
{
  "name": "@pbcjs/theme",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`packages/theme/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test", "scripts"]
}
```

Installa le dipendenze:

```bash
pnpm --filter @pbcjs/theme add @sinclair/typebox@^0.34.52 --config.minimum-release-age=1440
pnpm --filter @pbcjs/theme add -D vitest@^3.2.7 --config.minimum-release-age=1440
```

Expected: nessun errore `ERR_PNPM_*`; lockfile aggiornato.

- [ ] **Step 2: Scrivi i test di validazione (falliscono)**

`packages/theme/test/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateTheme, type TokenCategory } from '../src/index'

const base = { id: 'dark-fantasy', name: 'Dark Fantasy', version: '1.0.0', tokens: {} }

function withTokens(tokens: Record<string, unknown>) {
  return { ...base, tokens }
}

function acceptsToken(category: TokenCategory, value: string): boolean {
  return validateTheme(withTokens({ [category]: { x: value } })).ok
}

describe('validateTheme', () => {
  it('accepts a minimal theme and returns it', () => {
    expect(validateTheme(base)).toEqual({ ok: true, theme: base })
  })

  it('accepts a theme using every category and the reserved fields', () => {
    const theme = {
      ...base,
      tokens: {
        color: { bg: '#14110f', 'chat-action': '#c9a96e' },
        font: { body: 'Lora', heading: 'Cinzel' },
        radius: { base: '4px' },
        space: { '1': '0.25rem', '2': '0.5rem' },
        image: { logo: 'assets/logo.png' },
      },
      layout: null,
      components: { anything: true },
    }
    expect(validateTheme(theme).ok).toBe(true)
  })

  it.each([
    '#abc',
    '#AABBCC',
    '#aabbccdd',
    'rgb(1, 2, 3)',
    'rgba(1,2,3,0.5)',
    'rgb(1 2 3 / 50%)',
    'hsl(120deg, 50%, 50%)',
    'hsla(120, 50%, 50%, 0.3)',
  ])('accepts color %j', (value) => {
    expect(acceptsToken('color', value)).toBe(true)
  })

  it.each([
    'red',
    '#abcd',
    '#ggg',
    'rgb(1,2)',
    'rgb(a,b,c)',
    'var(--x)',
    'url(x)',
    'rgb(1,2,3);',
    '#fff; } body { display: none',
  ])('rejects color %j', (value) => {
    expect(acceptsToken('color', value)).toBe(false)
  })

  it.each(['Lora', "system-ui, -apple-system, 'Segoe UI', roboto, sans-serif", '"Cinzel", serif'])(
    'accepts font %j',
    (value) => {
      expect(acceptsToken('font', value)).toBe(true)
    },
  )

  it.each(['Lora; color: red', 'Lora}', 'url(x)', '<script>', 'Lora\\', ''])(
    'rejects font %j',
    (value) => {
      expect(acceptsToken('font', value)).toBe(false)
    },
  )

  it.each(['0', '4px', '0.5rem', '1.25em', '50%'])('accepts length %j', (value) => {
    expect(acceptsToken('radius', value)).toBe(true)
    expect(acceptsToken('space', value)).toBe(true)
  })

  it.each(['4', '4 px', '-1px', '4px;', 'calc(1px + 2px)', '1vh'])('rejects length %j', (value) => {
    expect(acceptsToken('radius', value)).toBe(false)
    expect(acceptsToken('space', value)).toBe(false)
  })

  it.each(['assets/logo.png', 'assets/img/bg.webp', 'assets/a.b.svg', 'assets/photo.jpeg'])(
    'accepts image %j',
    (value) => {
      expect(acceptsToken('image', value)).toBe(true)
    },
  )

  it.each([
    'logo.png',
    '/assets/logo.png',
    'assets/../secret.png',
    'assets//x.png',
    'assets/x.exe',
    'assets/x.png?x=1',
    'https://evil.example/x.png',
  ])('rejects image %j', (value) => {
    expect(acceptsToken('image', value)).toBe(false)
  })

  it.each(['chat-action', '1', 'h1'])('accepts token key %j', (key) => {
    expect(validateTheme(withTokens({ color: { [key]: '#000' } })).ok).toBe(true)
  })

  it.each(['Bg', '-bg', 'bg_x', ''])('rejects token key %j', (key) => {
    expect(validateTheme(withTokens({ color: { [key]: '#000' } })).ok).toBe(false)
  })

  it.each([
    ['id with spaces', { ...base, id: 'Dark Fantasy' }],
    ['id starting with dash', { ...base, id: '-dark' }],
    ['id too long', { ...base, id: 'a'.repeat(64) }],
    ['empty name', { ...base, name: '' }],
    ['name too long', { ...base, name: 'a'.repeat(81) }],
    ['short version', { ...base, version: '1.0' }],
    ['prefixed version', { ...base, version: 'v1.0.0' }],
    ['unknown top-level field', { ...base, author: 'me' }],
    ['unknown token category', withTokens({ shadow: { base: '0' } })],
    ['missing tokens', { id: 'x', name: 'X', version: '1.0.0' }],
  ])('rejects %s', (_label, theme) => {
    expect(validateTheme(theme).ok).toBe(false)
  })

  it('accepts a pre-release version', () => {
    expect(validateTheme({ ...base, version: '1.0.0-beta.1' }).ok).toBe(true)
  })

  it('reports errors with JSON-pointer paths', () => {
    const result = validateTheme(withTokens({ color: { bg: 'red' } }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.path === '/tokens/color/bg')).toBe(true)
    expect(result.errors.every((e) => typeof e.message === 'string')).toBe(true)
  })

  it.each([null, 'theme', 42, []])('rejects non-object input %j', (input) => {
    expect(validateTheme(input).ok).toBe(false)
  })
})
```

- [ ] **Step 3: Esegui i test e verifica che falliscano**

Run: `pnpm --filter @pbcjs/theme exec vitest run test/validate.test.ts`
Expected: FAIL, `../src/index` non trovato.

- [ ] **Step 4: Scrivi lo schema**

`packages/theme/src/schema.ts`:

```ts
import { Type, type Static } from '@sinclair/typebox'

const NUMBER = String.raw`-?\d+(?:\.\d+)?(?:%|deg)?`

export const ID_PATTERN = '^[a-z0-9][a-z0-9-]{0,62}$'
export const SEMVER_PATTERN = String.raw`^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$`
export const TOKEN_KEY_PATTERN = '^[a-z0-9][a-z0-9-]*$'
export const COLOR_PATTERN = String.raw`^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\(\s*${NUMBER}(?:\s*[,/\s]\s*${NUMBER}){2,3}\s*\))$`
export const FONT_PATTERN = `^[A-Za-z0-9 ,'"-]+$`
export const LENGTH_PATTERN = String.raw`^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))$`
export const IMAGE_PATTERN = String.raw`^assets/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:png|jpg|jpeg|webp|gif|avif|svg)$`

function category(valuePattern: string) {
  return Type.Optional(
    Type.Record(
      Type.String({ pattern: TOKEN_KEY_PATTERN }),
      Type.String({ pattern: valuePattern }),
      {
        additionalProperties: false,
      },
    ),
  )
}

export const ThemeTokens = Type.Object(
  {
    color: category(COLOR_PATTERN),
    font: category(FONT_PATTERN),
    radius: category(LENGTH_PATTERN),
    space: category(LENGTH_PATTERN),
    image: category(IMAGE_PATTERN),
  },
  { additionalProperties: false },
)
export type ThemeTokens = Static<typeof ThemeTokens>

export const ThemeManifest = Type.Object(
  {
    id: Type.String({ pattern: ID_PATTERN }),
    name: Type.String({ minLength: 1, maxLength: 80 }),
    version: Type.String({ pattern: SEMVER_PATTERN }),
    tokens: ThemeTokens,
    /** Reserved for configurable layouts (phase 3); ignored for now. */
    layout: Type.Optional(Type.Unknown()),
    /** Reserved for component overrides (phase 3); ignored for now. */
    components: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
)
export type ThemeManifest = Static<typeof ThemeManifest>

export type TokenCategory = keyof ThemeTokens

export const TOKEN_CATEGORIES: readonly TokenCategory[] = [
  'color',
  'font',
  'radius',
  'space',
  'image',
]
```

Nota: nessun pattern ammette `;`, `{`, `}`, `<` o `url(`, quindi un valore non può uscire dalla propria dichiarazione CSS. Il test `rejects token key` verifica che `additionalProperties: false` del `Record` blocchi le chiavi fuori pattern: se TypeBox non lo applicasse, il test fallisce e va corretto lo schema, non il test.

- [ ] **Step 5: Scrivi `validate.ts` e l'index**

`packages/theme/src/validate.ts`:

```ts
import { Value } from '@sinclair/typebox/value'
import { ThemeManifest } from './schema'

export interface ThemeValidationError {
  /** JSON pointer to the offending value, e.g. "/tokens/color/bg". */
  path: string
  message: string
}

export type ValidateThemeResult =
  { ok: true; theme: ThemeManifest } | { ok: false; errors: ThemeValidationError[] }

export function validateTheme(json: unknown): ValidateThemeResult {
  if (Value.Check(ThemeManifest, json)) return { ok: true, theme: json }
  const errors = [...Value.Errors(ThemeManifest, json)].map((error) => ({
    path: error.path,
    message: error.message,
  }))
  return { ok: false, errors }
}
```

`packages/theme/src/index.ts`:

```ts
export { ThemeManifest, ThemeTokens, TOKEN_CATEGORIES, type TokenCategory } from './schema'
export { validateTheme, type ThemeValidationError, type ValidateThemeResult } from './validate'
```

- [ ] **Step 6: Esegui i test e verifica che passino**

Run: `pnpm --filter @pbcjs/theme exec vitest run test/validate.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck e lint dei file nuovi**

Run:

```bash
pnpm --filter @pbcjs/theme typecheck
pnpm exec eslint packages/theme/src packages/theme/test
pnpm exec prettier --check packages/theme
```

Expected: tutti exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/theme pnpm-lock.yaml
git commit -m "feat(theme): add theme.json schema and validation"
```

---

### Task 2: Merge, CSS variables e tema `default` come fonte di `tokens.css`

**Files:**

- Create: `packages/theme/src/merge.ts`, `packages/theme/src/css-vars.ts`
- Create: `packages/theme/scripts/default-tokens.ts`, `packages/theme/scripts/build-default.ts`
- Create: `packages/theme/test/merge.test.ts`, `packages/theme/test/css-vars.test.ts`, `packages/theme/test/default-theme.test.ts`
- Create: `themes/default/theme.json`
- Modify: `packages/theme/src/index.ts`, `packages/theme/package.json` (script `build:default`, devDependency `tsx`), root `package.json` (script `theme:build`), `apps/web/src/theme/tokens.css` (rigenerato), `pnpm-lock.yaml`

**Interfaces:**

- Consumes (Task 1): `ThemeManifest`, `ThemeTokens`, `TOKEN_CATEGORIES`, `validateTheme`.
- Produces:
  - `mergeWithDefault(theme: ThemeManifest, defaultTheme: ThemeManifest): ThemeManifest`
  - `toCssVariables(tokens: ThemeTokens, opts?: CssVariablesOptions): string` con `interface CssVariablesOptions { assetBaseUrl?: string }`
  - `scripts/default-tokens.ts`: `DEFAULT_THEME_PATH`, `TOKENS_CSS_PATH`, `TOKENS_CSS_HEADER`, `renderDefaultTokensCss(): Promise<string>`
  - script root `pnpm theme:build`

Formato di `toCssVariables`: `:root {`, una riga per token con due spazi di rientro (`  --pbc-<categoria>-<chiave>: <valore>;`), `}` e newline finale. Senza token: `:root {\n}\n`. Le immagini diventano `url('<percorso>')`, oppure `url('<assetBaseUrl senza / finali>/<percorso>')` se `assetBaseUrl` è dato (apici singoli, come li normalizza prettier).

- [ ] **Step 1: Scrivi i test di merge e CSS (falliscono)**

`packages/theme/test/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergeWithDefault, type ThemeManifest } from '../src/index'

const defaultTheme: ThemeManifest = {
  id: 'default',
  name: 'Default',
  version: '1.0.0',
  tokens: {
    color: { bg: '#000', text: '#fff' },
    font: { body: 'Lora' },
    radius: { base: '4px' },
  },
}

const theme: ThemeManifest = {
  id: 'dark',
  name: 'Dark',
  version: '2.0.0',
  tokens: {
    color: { text: '#eee', extra: '#123' },
    space: { '1': '1rem' },
  },
  layout: null,
}

describe('mergeWithDefault', () => {
  it('inherits missing tokens and keeps overrides and extras', () => {
    expect(mergeWithDefault(theme, defaultTheme)).toEqual({
      id: 'dark',
      name: 'Dark',
      version: '2.0.0',
      tokens: {
        color: { bg: '#000', text: '#eee', extra: '#123' },
        font: { body: 'Lora' },
        radius: { base: '4px' },
        space: { '1': '1rem' },
      },
      layout: null,
    })
  })

  it('keeps default key order with extras appended', () => {
    const merged = mergeWithDefault(theme, defaultTheme)
    expect(Object.keys(merged.tokens.color ?? {})).toEqual(['bg', 'text', 'extra'])
  })

  it('does not mutate its inputs', () => {
    const before = JSON.stringify([theme, defaultTheme])
    mergeWithDefault(theme, defaultTheme)
    expect(JSON.stringify([theme, defaultTheme])).toBe(before)
  })

  it('omits categories that are empty in both themes', () => {
    const merged = mergeWithDefault(theme, defaultTheme)
    expect(Object.keys(merged.tokens)).toEqual(['color', 'font', 'radius', 'space'])
  })
})
```

`packages/theme/test/css-vars.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toCssVariables } from '../src/index'

describe('toCssVariables', () => {
  it('emits categories in fixed order with --pbc- prefixes', () => {
    const css = toCssVariables({
      image: { logo: 'assets/logo.png' },
      color: { bg: '#000', 'chat-action': '#111' },
      space: { '2': '1rem', '1': '0.5rem' },
      font: { body: "'Segoe UI', sans-serif" },
      radius: { base: '4px' },
    })
    expect(css).toBe(
      [
        ':root {',
        '  --pbc-color-bg: #000;',
        '  --pbc-color-chat-action: #111;',
        "  --pbc-font-body: 'Segoe UI', sans-serif;",
        '  --pbc-radius-base: 4px;',
        '  --pbc-space-1: 0.5rem;',
        '  --pbc-space-2: 1rem;',
        "  --pbc-image-logo: url('assets/logo.png');",
        '}',
        '',
      ].join('\n'),
    )
  })

  it('prefixes image paths with assetBaseUrl', () => {
    const css = toCssVariables(
      { image: { logo: 'assets/logo.png' } },
      { assetBaseUrl: '/themes/dark/' },
    )
    expect(css).toContain("--pbc-image-logo: url('/themes/dark/assets/logo.png');")
  })

  it('emits an empty block without tokens', () => {
    expect(toCssVariables({})).toBe(':root {\n}\n')
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm --filter @pbcjs/theme exec vitest run test/merge.test.ts test/css-vars.test.ts`
Expected: FAIL, `mergeWithDefault`/`toCssVariables` non esportati.

- [ ] **Step 3: Implementa merge e CSS variables**

`packages/theme/src/merge.ts`:

```ts
import { TOKEN_CATEGORIES, type ThemeManifest, type ThemeTokens } from './schema'

/** Fills tokens missing from theme with the default theme's; extra keys are kept. */
export function mergeWithDefault(theme: ThemeManifest, defaultTheme: ThemeManifest): ThemeManifest {
  const tokens: ThemeTokens = {}
  for (const category of TOKEN_CATEGORIES) {
    const merged = { ...defaultTheme.tokens[category], ...theme.tokens[category] }
    if (Object.keys(merged).length > 0) tokens[category] = merged
  }
  return { ...theme, tokens }
}
```

`packages/theme/src/css-vars.ts`:

```ts
import { TOKEN_CATEGORIES, type ThemeTokens } from './schema'

export interface CssVariablesOptions {
  /** Prefix for image paths, e.g. "/themes/dark". */
  assetBaseUrl?: string
}

export function toCssVariables(tokens: ThemeTokens, opts: CssVariablesOptions = {}): string {
  const lines: string[] = []
  for (const category of TOKEN_CATEGORIES) {
    for (const [key, value] of Object.entries(tokens[category] ?? {})) {
      const cssValue = category === 'image' ? imageUrl(value, opts.assetBaseUrl) : value
      lines.push(`  --pbc-${category}-${key}: ${cssValue};`)
    }
  }
  return lines.length === 0 ? ':root {\n}\n' : `:root {\n${lines.join('\n')}\n}\n`
}

function imageUrl(path: string, assetBaseUrl: string | undefined): string {
  const url = assetBaseUrl === undefined ? path : `${assetBaseUrl.replace(/\/+$/, '')}/${path}`
  return `url('${url}')`
}
```

Aggiungi a `packages/theme/src/index.ts`:

```ts
export { mergeWithDefault } from './merge'
export { toCssVariables, type CssVariablesOptions } from './css-vars'
```

`ThemeManifest` e `ThemeTokens` sono esportati sia come valore (schema TypeBox) sia come tipo con lo stesso nome, quindi `import { type ThemeManifest } from '../src/index'` funziona senza modifiche all'export.

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm --filter @pbcjs/theme exec vitest run test/merge.test.ts test/css-vars.test.ts`
Expected: PASS.

- [ ] **Step 5: Crea il tema `default`**

`themes/default/theme.json` (stessi valori dell'attuale `apps/web/src/theme/tokens.css`; `font.chat` reso esplicito):

```json
{
  "id": "default",
  "name": "Default",
  "version": "1.0.0",
  "tokens": {
    "color": {
      "bg": "#16181d",
      "surface": "#20232b",
      "text": "#e6e6e6",
      "text-muted": "#9aa0ab",
      "primary": "#c9a227",
      "danger": "#e0605e",
      "chat-action": "#d9b46c",
      "chat-master": "#8fb3d9"
    },
    "font": {
      "body": "system-ui, -apple-system, 'Segoe UI', roboto, sans-serif",
      "heading": "georgia, 'Times New Roman', serif",
      "chat": "system-ui, -apple-system, 'Segoe UI', roboto, sans-serif"
    },
    "radius": {
      "base": "6px"
    },
    "space": {
      "1": "0.25rem",
      "2": "0.5rem",
      "3": "1rem",
      "4": "2rem"
    }
  },
  "layout": null,
  "components": null
}
```

- [ ] **Step 6: Scrivi il test del tema default e di sincronizzazione (fallisce)**

`packages/theme/test/default-theme.test.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { TOKEN_CATEGORIES, validateTheme } from '../src/index'
import {
  DEFAULT_THEME_PATH,
  renderDefaultTokensCss,
  TOKENS_CSS_HEADER,
  TOKENS_CSS_PATH,
} from '../scripts/default-tokens'

describe('default theme', () => {
  it('is a valid theme with id "default"', async () => {
    const result = validateTheme(JSON.parse(await readFile(DEFAULT_THEME_PATH, 'utf8')))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.theme.id).toBe('default')
  })

  it('defines every category except image', async () => {
    const theme = JSON.parse(await readFile(DEFAULT_THEME_PATH, 'utf8'))
    for (const category of TOKEN_CATEGORIES.filter((c) => c !== 'image')) {
      expect(Object.keys(theme.tokens[category] ?? {}).length, category).toBeGreaterThan(0)
    }
  })

  it('renders tokens.css with the generated-file header', async () => {
    expect((await renderDefaultTokensCss()).startsWith(`${TOKENS_CSS_HEADER}\n:root {\n`)).toBe(
      true,
    )
  })

  it('keeps apps/web/src/theme/tokens.css in sync with theme.json', async () => {
    const actual = await readFile(TOKENS_CSS_PATH, 'utf8')
    expect(actual, 'tokens.css is out of date: run pnpm theme:build').toBe(
      await renderDefaultTokensCss(),
    )
  })
})
```

Run: `pnpm --filter @pbcjs/theme exec vitest run test/default-theme.test.ts`
Expected: FAIL, `../scripts/default-tokens` non trovato.

- [ ] **Step 7: Scrivi il modulo condiviso e lo script del generatore**

`packages/theme/scripts/default-tokens.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toCssVariables } from '../src/css-vars'
import { validateTheme } from '../src/validate'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

export const DEFAULT_THEME_PATH = join(repoRoot, 'themes/default/theme.json')
export const TOKENS_CSS_PATH = join(repoRoot, 'apps/web/src/theme/tokens.css')
export const TOKENS_CSS_HEADER =
  '/* Generated from themes/default/theme.json by pnpm theme:build — do not edit */'

export async function renderDefaultTokensCss(): Promise<string> {
  const result = validateTheme(JSON.parse(await readFile(DEFAULT_THEME_PATH, 'utf8')))
  if (!result.ok) {
    const details = result.errors.map((e) => `  ${e.path} ${e.message}`).join('\n')
    throw new Error(`Invalid ${DEFAULT_THEME_PATH}:\n${details}`)
  }
  return `${TOKENS_CSS_HEADER}\n${toCssVariables(result.theme.tokens)}`
}
```

`packages/theme/scripts/build-default.ts`:

```ts
import { writeFile } from 'node:fs/promises'
import { renderDefaultTokensCss, TOKENS_CSS_PATH } from './default-tokens'

await writeFile(TOKENS_CSS_PATH, await renderDefaultTokensCss())
console.log(`Wrote ${TOKENS_CSS_PATH}`)
```

Installa tsx e aggiungi gli script:

```bash
pnpm --filter @pbcjs/theme add -D tsx@^4.23.15 --config.minimum-release-age=1440
```

In `packages/theme/package.json`, `scripts`:

```json
"build:default": "tsx scripts/build-default.ts"
```

Nel `package.json` root, `scripts` (dopo `format`):

```json
"theme:build": "pnpm --filter @pbcjs/theme build:default"
```

- [ ] **Step 8: Genera `tokens.css` e controlla il risultato**

Run: `pnpm theme:build`
Expected: `Wrote .../apps/web/src/theme/tokens.css`.

Run: `git diff apps/web/src/theme/tokens.css`
Expected: le uniche differenze sono la riga di header in cima e `--pbc-font-chat`, che passa da `var(--pbc-font-body)` a `system-ui, -apple-system, 'Segoe UI', roboto, sans-serif`. Tutti gli altri valori e l'ordine delle righe restano identici.

Run:

```bash
pnpm exec prettier --check apps/web/src/theme/tokens.css themes/default/theme.json
pnpm exec stylelint apps/web/src/theme/tokens.css
```

Expected: entrambi exit 0. Se prettier o stylelint vogliono modificare `tokens.css`, correggi il formato prodotto da `toCssVariables` (e il suo test), non il file generato: il pre-commit hook esegue `prettier --write` e `stylelint --fix`, e qualsiasi modifica romperebbe il test di sincronizzazione.

- [ ] **Step 9: Esegui i test del package**

Run: `pnpm --filter @pbcjs/theme test`
Expected: PASS, inclusi `default-theme.test.ts` e il test di sincronizzazione.

Run: `pnpm theme:build && git status --porcelain apps/web/src/theme/tokens.css`
Expected: dopo la seconda generazione nessuna differenza rispetto alla prima (output deterministico).

- [ ] **Step 10: Verifica che la web app resti invariata**

Run: `pnpm --filter @pbcjs/web test && pnpm --filter @pbcjs/web build`
Expected: entrambi exit 0.

- [ ] **Step 11: Typecheck e lint dei file nuovi o modificati**

Run:

```bash
pnpm --filter @pbcjs/theme typecheck
pnpm exec eslint packages/theme
pnpm exec prettier --check packages/theme package.json
```

Expected: tutti exit 0.

- [ ] **Step 12: Commit**

```bash
git add packages/theme themes/default/theme.json apps/web/src/theme/tokens.css package.json pnpm-lock.yaml
git commit -m "feat(theme): generate web tokens.css from the default theme"
```

Dopo il commit, `git status` deve essere pulito: se il pre-commit hook ha modificato `tokens.css`, torna allo Step 8.

---

### Task 3: `sanitizeCustomCss` e verifica finale dello step 1

**Files:**

- Create: `packages/theme/src/errors.ts`, `packages/theme/src/sanitize.ts`, `packages/theme/test/sanitize.test.ts`
- Modify: `packages/theme/src/index.ts`, `packages/theme/package.json`, `pnpm-lock.yaml`

**Interfaces:**

- Consumes: niente dai task precedenti oltre all'index.
- Produces:
  - `class ThemeError extends Error { code: ThemeErrorCode }`, `type ThemeErrorCode = 'THEME_CSS_INVALID'`, costruttore `new ThemeError(code, message)`
  - `sanitizeCustomCss(css: string): SanitizeResult` con `interface SanitizeResult { css: string; removed: string[] }`; ogni voce di `removed` è `"<prop>: <value>"` per le dichiarazioni e `"@<name> <params>"` per le at-rule.

- [ ] **Step 1: Installa le dipendenze**

```bash
pnpm --filter @pbcjs/theme add postcss@^8 postcss-value-parser@^4 --config.minimum-release-age=1440
```

Expected: nessun errore; `postcss` risolto alla versione già presente nel lockfile se compatibile.

- [ ] **Step 2: Scrivi i test (falliscono)**

`packages/theme/test/sanitize.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sanitizeCustomCss, ThemeError } from '../src/index'

describe('sanitizeCustomCss', () => {
  it('leaves safe CSS untouched', () => {
    const css = [
      '.pbc-chat { color: var(--pbc-color-text); background: url("assets/bg.png"); }',
      ".pbc-sheet { background-image: url('img/paper.webp'), url(data:image/png;base64,AAAA); }",
      '@font-face { font-family: Cinzel; src: local(Cinzel), url(assets/cinzel.woff2); }',
      '@media (width >= 600px) { .pbc-chat { padding: 1rem; } }',
    ].join('\n')
    expect(sanitizeCustomCss(css)).toEqual({ css, removed: [] })
  })

  it.each([
    '@import url("https://evil.example/x.css");',
    '@import "local.css";',
    '@IMPORT "local.css";',
  ])('removes %j', (rule) => {
    const result = sanitizeCustomCss(`${rule}\n.pbc-chat { color: red; }`)
    expect(result.css).not.toMatch(/@import/i)
    expect(result.css).toContain('.pbc-chat')
    expect(result.removed).toHaveLength(1)
    expect(result.removed[0]).toMatch(/^@import /i)
  })

  it.each([
    'background: url(https://evil.example/t.png)',
    'background: url("http://evil.example/t.png")',
    "background: url('//evil.example/t.png')",
    'background: URL(HTTPS://evil.example/t.png)',
    'background: url( "https://evil.example/t.png" )',
    'background: url(javascript:alert(1))',
    'background: url(data:text/html;base64,AAAA)',
    'background-image: image-set("https://evil.example/a.png" 1x)',
    'background: u\\72l(https://evil.example/t.png)',
    'content: "\\201C"',
    'width: expression(alert(1))',
    'behavior: url(x.htc)',
    '-moz-binding: url(x.xml#x)',
    'beh\\avior: url(x.htc)',
  ])('removes the declaration %j', (declaration) => {
    const result = sanitizeCustomCss(`.pbc-chat { color: red; ${declaration}; }`)
    expect(result.removed).toEqual([declaration])
    expect(result.css).toContain('color: red')
    expect(result.css).not.toContain(declaration)
  })

  it('removes external fonts inside @font-face', () => {
    const result = sanitizeCustomCss(
      '@font-face { font-family: X; src: url(https://fonts.example/x.woff2); }',
    )
    expect(result.css).not.toContain('fonts.example')
    expect(result.removed).toEqual(['src: url(https://fonts.example/x.woff2)'])
  })

  it('removes at-rules whose params load external resources', () => {
    const result = sanitizeCustomCss('@namespace svg url(http://www.w3.org/2000/svg);')
    expect(result.css).not.toContain('w3.org')
    expect(result.removed).toHaveLength(1)
  })

  it('throws THEME_CSS_INVALID on unparsable CSS', () => {
    let error: unknown
    try {
      sanitizeCustomCss('.pbc-chat { color: red')
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(ThemeError)
    expect((error as ThemeError).code).toBe('THEME_CSS_INVALID')
  })
})
```

Run: `pnpm --filter @pbcjs/theme exec vitest run test/sanitize.test.ts`
Expected: FAIL, `sanitizeCustomCss` non esportato.

- [ ] **Step 3: Implementa**

`packages/theme/src/errors.ts`:

```ts
export type ThemeErrorCode = 'THEME_CSS_INVALID'

export class ThemeError extends Error {
  readonly code: ThemeErrorCode

  constructor(code: ThemeErrorCode, message: string) {
    super(message)
    this.name = 'ThemeError'
    this.code = code
  }
}
```

`packages/theme/src/sanitize.ts`:

```ts
import postcss, { CssSyntaxError, type Root } from 'postcss'
import valueParser from 'postcss-value-parser'
import { ThemeError } from './errors'

export interface SanitizeResult {
  css: string
  /** Human-readable list of what was removed. */
  removed: string[]
}

const BLOCKED_PROPERTIES = new Set(['behavior', '-moz-binding'])
const SAFE_DATA_URL = /^data:image\//i
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * Strips constructs that could load external resources (and so track players)
 * or execute code: @import, absolute url(), image-set() strings, expression(),
 * behavior, -moz-binding, and any backslash escape that could hide them.
 */
export function sanitizeCustomCss(css: string): SanitizeResult {
  let root: Root
  try {
    root = postcss.parse(css)
  } catch (err) {
    if (err instanceof CssSyntaxError) throw new ThemeError('THEME_CSS_INVALID', err.message)
    throw err
  }

  const removed: string[] = []
  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === 'import' || isUnsafeValue(rule.params)) {
      removed.push(`@${rule.name} ${rule.params}`)
      rule.remove()
    }
  })
  root.walkDecls((decl) => {
    if (
      decl.prop.includes('\\') ||
      BLOCKED_PROPERTIES.has(decl.prop.toLowerCase()) ||
      isUnsafeValue(decl.value)
    ) {
      removed.push(`${decl.prop}: ${decl.value}`)
      decl.remove()
    }
  })
  return { css: root.toString(), removed }
}

function isUnsafeValue(value: string): boolean {
  if (value.includes('\\')) return true
  let unsafe = false
  valueParser(value).walk((node) => {
    if (node.type !== 'function') return
    const name = node.value.toLowerCase()
    if (name === 'expression') {
      unsafe = true
    } else if (name === 'url') {
      const url = valueParser
        .stringify(node.nodes)
        .trim()
        .replace(/^['"]|['"]$/g, '')
      if (isExternalUrl(url)) unsafe = true
    } else if (name.endsWith('image-set')) {
      if (node.nodes.some((child) => child.type === 'string' && isExternalUrl(child.value))) {
        unsafe = true
      }
    }
  })
  return unsafe
}

function isExternalUrl(url: string): boolean {
  const trimmed = url.trim()
  if (SAFE_DATA_URL.test(trimmed)) return false
  return trimmed.startsWith('//') || HAS_SCHEME.test(trimmed)
}
```

Aggiungi a `packages/theme/src/index.ts`:

```ts
export { ThemeError, type ThemeErrorCode } from './errors'
export { sanitizeCustomCss, type SanitizeResult } from './sanitize'
```

Note:

- `@font-face` è un'at-rule senza params: le sue dichiarazioni `src` passano per `walkDecls`.
- Se `tsc` rifiuta il default import di `postcss-value-parser` (modulo CommonJS con `export =`), verifica prima che `allowSyntheticDefaultImports` sia attivo (implicito con `moduleResolution: Bundler`). Non disattivare `verbatimModuleSyntax` nel `tsconfig.base.json`.

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm --filter @pbcjs/theme exec vitest run test/sanitize.test.ts`
Expected: PASS.

Se il caso `leaves safe CSS untouched` fallisce per differenze di spazi o punti e virgola, il codice sta riscrivendo CSS che non doveva toccare: `root.toString()` di postcss preserva il sorgente quando nulla viene rimosso, quindi cerca la regola che rimuove qualcosa per errore.

- [ ] **Step 5: Typecheck e lint dei file nuovi o modificati**

Run:

```bash
pnpm --filter @pbcjs/theme typecheck
pnpm exec eslint packages/theme
pnpm exec prettier --check packages/theme
```

Expected: tutti exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/theme pnpm-lock.yaml
git commit -m "feat(theme): sanitize custom.css against external resources and code"
```

- [ ] **Step 7: Verifica finale dello step 1 (Definition of Done)**

Questa è la verifica equivalente alla CI, quindi qui il lint gira sull'intero progetto.

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: exit 0. I test includono `@pbcjs/dice` e `@pbcjs/theme`.

Run: `pnpm theme:build && git status --porcelain`
Expected: output vuoto (il generatore non produce modifiche su un checkout pulito).

Run: `pnpm --filter @pbcjs/dice roll "4d6kh3+{forza}" --var forza=3`
Expected: totale e dettaglio dei dadi, exit 0.

Nessun commit in questo step: se qualcosa fallisce, correggi nel task competente e committa lì.

## Definition of Done (1b e step 1)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verde.
- `pnpm --filter @pbcjs/dice roll "4d6kh3+{forza}" --var forza=3` stampa totale e dettaglio; formula invalida → exit code 1 con posizione dell'errore.
- `pnpm theme:build` su checkout pulito non produce modifiche (`git status` pulito).
- Web app visivamente invariata: valori dei token identici, unica differenza `--pbc-font-chat` espanso alla stessa lista del body.
