# pbcjs — Step 1: motore dadi e libreria temi

- **Data:** 2026-10-28
- **Stato:** approvato in brainstorming, in revisione
- **Riferimenti:** [design di fondazione](2026-10-27-pbcjs-foundation-design.md) §5, §6, §9, §10
- **Piani:** 1a `packages/dice`, 1b `packages/theme` (indipendenti, eseguiti in sequenza)

## 1. Obiettivo

Realizzare le due librerie pure previste dalla roadmap allo step 1:

- `@pbcjs/dice`: formula → AST → risultato, con limiti anti-abuso, errori posizionali e CLI di prova.
- `@pbcjs/theme`: schema di `theme.json`, validazione, merge con il tema `default`, generazione delle CSS variables, sanitizzazione di `custom.css`.

Il tema `default` diventa fonte unica dei token: `themes/default/theme.json` genera `apps/web/src/theme/tokens.css`.

Fuori perimetro: uso dei package da parte dell'API (step 3 e 8), caricamento dei temi a runtime, upload zip, editor visuale, font Google (step 8).

## 2. `packages/dice`

### 2.1 Grammatica

Parser a discesa ricorsiva scritto a mano. Nessun `eval`.

```
expr    := term (('+' | '-') term)*
term    := unary (('*' | '/') unary)*
unary   := '-' unary | primary
primary := int | dice | var | call | '(' expr ')'
dice    := [count] 'd' sides [('kh' | 'kl') int]
count   := int | var
sides   := int | var
var     := '{' [a-z][a-z0-9_]* '}'
call    := ('min' | 'max') '(' expr (',' expr)+ ')'
```

- `int` è una sequenza di cifre decimali.
- Gli spazi sono ignorati. `d`, `kh`, `kl`, `min`, `max` non distinguono maiuscole e minuscole.
- `d20` equivale a `1d20`.
- Lunghezza massima della formula: 200 caratteri, altrimenti `DICE_SYNTAX`.

### 2.2 API

```ts
parse(formula: string): DiceAst                       // lancia DiceError
evaluate(ast: DiceAst, opts: { vars?: Record<string, number>; rng?: Rng }): RollResult
roll(formula: string, opts?: { vars?: Record<string, number>; rng?: Rng }): RollResult
validate(formula: string, opts?: { knownVars?: string[] }): { ok: boolean; errors: DiceError[] }
type Rng = (min: number, max: number) => number       // estremi inclusi
```

- `validate` non lancia mai eccezioni. Controlla la sintassi e, se `knownVars` è presente, che ogni variabile sia nota (`DICE_UNKNOWN_VARIABLE`). Serve all'editor admin della formula.
- `rng` di default: `crypto.randomInt(min, max + 1)`.

### 2.3 Risultato

```ts
interface RollResult {
  total: number
  formula: string // formula originale
  resolved: string // variabili sostituite, es. "4d6kh3+3"
  rolls: Array<{
    die: string // termine risolto, es. "4d6kh3"
    results: number[] // tutti i dadi tirati, in ordine
    kept: number[] // indici in results dei dadi tenuti
  }>
}
```

Senza `kh`/`kl`, `kept` contiene tutti gli indici. Il risultato viene salvato così com'è nei messaggi di chat (step 6).

### 2.4 Semantica

- Divisione intera verso il basso (`Math.floor`). Divisione per 0: `DICE_DIVISION_BY_ZERO`.
- Il totale può essere negativo.
- `min` e `max` accettano due o più argomenti.
- `khN` / `klN`: tiene i N dadi più alti / più bassi; richiede `1 ≤ N ≤ count`, altrimenti `DICE_INVALID_KEEP`. A parità di valore vengono tenuti i dadi con indice più basso.
- Variabile non presente in `vars`: `DICE_UNKNOWN_VARIABLE`.

### 2.5 Limiti

Controllati in valutazione, perché `count` e `sides` possono venire da variabili:

- `count ≥ 1`;
- `sides` tra 2 e 1000;
- al massimo 100 dadi per tiro, sommando tutti i termini.

Violazione: `DICE_LIMIT`.

### 2.6 Errori

```ts
class DiceError extends Error {
  code:
    | 'DICE_SYNTAX'
    | 'DICE_UNKNOWN_VARIABLE'
    | 'DICE_LIMIT'
    | 'DICE_DIVISION_BY_ZERO'
    | 'DICE_INVALID_KEEP'
  position?: number // indice del carattere, sempre presente per DICE_SYNTAX
}
```

I codici sono stabili: l'API li esporrà e il frontend li tradurrà con i18n.

### 2.7 CLI di prova

```
pnpm --filter @pbcjs/dice roll "4d6kh3+{forza}" --var forza=3 [--json]
```

- Eseguita con tsx (`src/cli.ts`).
- Output testuale: totale, formula risolta, dettaglio dei dadi con quelli scartati evidenziati. Con `--json` stampa il `RollResult`.
- Formula invalida: messaggio con codice e posizione su stderr, exit code 1.

## 3. `packages/theme`

### 3.1 Schema

`ThemeManifest`, definito con TypeBox:

| Campo                  | Regola                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| `id`                   | `^[a-z0-9][a-z0-9-]{0,62}$`                                                 |
| `name`                 | da 1 a 80 caratteri                                                         |
| `version`              | semver                                                                      |
| `tokens`               | oggetto con categorie opzionali `color`, `font`, `radius`, `space`, `image` |
| `layout`, `components` | riservati: accettati con qualsiasi valore e ignorati                        |

Ogni categoria è una mappa `chiave → valore`, con chiave `^[a-z][a-z0-9-]*$`.

| Categoria         | Valori ammessi                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `color`           | `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`, `hsla()` con argomenti numerici (anche percentuali)              |
| `font`            | lista di famiglie separate da virgola; solo caratteri `[A-Za-z0-9 ,'"-]`                                                     |
| `radius`, `space` | `0` oppure numero con unità `px`, `rem`, `em`, `%`                                                                           |
| `image`           | percorso relativo sotto `assets/`, senza `..` né `/` iniziale, estensione `png`, `jpg`, `jpeg`, `webp`, `gif`, `avif`, `svg` |

I pattern escludono `;`, `{`, `}`, `<` e `url(`, quindi un token non può iniettare CSS.

`space` è una categoria nuova rispetto al design di fondazione (§6.1): serve ai token `--pbc-space-*` già usati dalla web app.

### 3.2 API

```ts
validateTheme(json: unknown):
  | { ok: true; theme: ThemeManifest }
  | { ok: false; errors: Array<{ path: string; message: string }> }   // path JSON-pointer
mergeWithDefault(theme: ThemeManifest, defaultTheme: ThemeManifest): ThemeManifest
toCssVariables(tokens: ThemeTokens, opts?: { assetBaseUrl?: string }): string
sanitizeCustomCss(css: string): { css: string; removed: string[] }    // lancia ThemeError
```

- **`mergeWithDefault`:** merge per categoria. Le chiavi mancanti ereditano dal `default`; le chiavi in più restano, perché possono servire a `custom.css`.
- **`toCssVariables`:** restituisce un blocco `:root { ... }` con una variabile `--pbc-<categoria>-<chiave>` per token.
  - Le categorie sono in ordine fisso: color, font, radius, space, image. Dentro ogni categoria vale l'ordine del JSON. L'output è quindi deterministico.
  - Le immagini diventano `url("<assetBaseUrl>/<path>")`.
  - Formato: due spazi di indentazione e newline finale, compatibile con prettier e stylelint.
- **`sanitizeCustomCss`:** usa postcss e postcss-value-parser. Rimuove:
  - le regole `@import`;
  - le dichiarazioni con `url()` assoluti (`http:`, `https:`, `//`, qualsiasi altro schema tranne `data:image/*`); i percorsi relativi restano;
  - le dichiarazioni il cui valore contiene escape `\`, che potrebbero mascherare `url(`;
  - `expression()`, le proprietà `behavior` e `-moz-binding`.

  `removed` elenca in testo ciò che è stato tolto. Un CSS non parsabile lancia `ThemeError` con codice `THEME_CSS_INVALID`.

### 3.3 Tema `default` e generazione di `tokens.css`

- `themes/default/theme.json` (`id: "default"`) contiene gli stessi valori dell'attuale `apps/web/src/theme/tokens.css`. `font.chat` diventa esplicito: oggi è `var(--pbc-font-body)`, nel JSON sarà la stessa lista di font del body.
- `pnpm theme:build` (script root) esegue `packages/theme/scripts/build-default.ts` con tsx. Lo script valida il tema e scrive `apps/web/src/theme/tokens.css` preceduto da:
  ```css
  /* Generated from themes/default/theme.json by pnpm theme:build — do not edit */
  ```
- Un test in `packages/theme` rigenera il CSS in memoria e lo confronta con il file. Se sono diversi fallisce con il messaggio "run pnpm theme:build", quindi la CI blocca le derive.
- I valori dei token restano invariati: la web app ha lo stesso aspetto.

## 4. Struttura e integrazione

```
packages/dice/
  src/{lexer,parser,evaluate,errors,rng,index,cli}.ts
  test/*.test.ts
packages/theme/
  src/{schema,validate,merge,css-vars,sanitize,errors,index}.ts
  scripts/build-default.ts
  test/*.test.ts
themes/default/theme.json
```

- **Package:** solo sorgente come `@pbcjs/shared` (`exports: ./src/index.ts`, script `test` e `typecheck`).
- **Dipendenze di `dice`:** solo Node a runtime; devDependencies `fast-check`, `tsx`.
- **Dipendenze di `theme`:** `@sinclair/typebox`, `postcss`, `postcss-value-parser`; devDependency `tsx`.
- **App:** nessuna li usa ancora come dipendenza. L'unica integrazione è `tokens.css` generato.
- **CI:** quella esistente copre i nuovi package tramite `pnpm -r`; nessun job nuovo.
- **Lockfile:** le nuove dipendenze rispettano il `minimumReleaseAge` di pnpm, senza override.

## 5. Test

- **dice, unit:**
  - lexer e parser, con errori e relative posizioni;
  - ogni operatore, divisione intera, `min` e `max`;
  - `kh` e `kl`, anche a parità di valore;
  - limiti e variabili;
  - `validate` con `knownVars`;
  - CLI: output, `--json`, exit code 1.
- **dice, property-based (fast-check):**
  - `NdM` sta sempre tra N e N·M;
  - `kh` e `kl` tengono esattamente N dadi;
  - `parse` su stringhe casuali non lancia mai eccezioni che non siano `DiceError`;
  - a parità di formula, variabili e RNG il risultato è identico.
- **theme:**
  - validazione con casi validi e invalidi per ogni categoria, inclusi tentativi di iniezione;
  - merge;
  - output di `toCssVariables` confrontato con quello atteso;
  - sanitizzazione: `@import`, url esterni, `data:`, escape, `expression()`;
  - sincronizzazione tra `theme.json` e `tokens.css`.

## 6. Definition of Done

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` termina con exit 0.
- `pnpm --filter @pbcjs/dice roll "4d6kh3+{forza}" --var forza=3` stampa totale e dettaglio; con una formula invalida esce con codice 1 e indica la posizione dell'errore.
- `pnpm theme:build` su un checkout pulito non produce modifiche (`git status` pulito).
- La web app è visivamente invariata: valori dei token identici.
