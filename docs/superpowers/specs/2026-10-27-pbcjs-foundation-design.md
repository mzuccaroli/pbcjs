# pbcjs — Design di fondazione

- **Data:** 2026-10-27
- **Stato:** approvato in brainstorming, in revisione
- **Riferimenti:** [GDRCD](https://github.com/GDRCD/GDRCD), [Logeon](https://github.com/Gekis-Geko/Logeon)

## 1. Obiettivo

pbcjs è un motore open source per giochi di ruolo "play by chat" via browser, ispirato a GDRCD e Logeon, costruito su Node.js + Fastify (backend) e Vue 3 (frontend).

Obiettivi chiave:

1. **Self-hosted, un'istanza per gioco**, installabile con un solo `docker compose up`.
2. **Personalizzazione grafica senza programmare**: temi a pacchetto basati su token, con editor visuale nel pannello admin.
3. **Regolamento configurabile da dati**: attributi, abilità, razze e formula di tiro definiti dall'admin.
4. **Predisposizione multi-tenant**: nessuna scelta architetturale che impedisca in futuro più giochi su una piattaforma.

Fuori perimetro: multi-tenant effettivo (solo predisposto), app mobile nativa.

## 2. Feature lato utente

### Fase 1 — MVP

- **Account:** registrazione e login via email, reset password via email, più personaggi per account (limite configurabile).
- **Personaggio:** creazione guidata (razza, distribuzione punti su attributi e abilità), scheda pubblica (avatar, descrizione, background, statistiche), stato online.
- **Mappe e luoghi:** mappa cliccabile con luoghi; luoghi pubblici, privati o su invito; lista dei presenti.
- **Chat di luogo:** parlato, azione, sussurro, azione master, azione PNG, tiro di dado o abilità con dettaglio registrato, messaggi di sistema; storico paginato; formattazione Markdown base; export della giocata in Markdown.
- **Ruoli e permessi:** giocatore, master, moderatore, admin; permessi a grana fine.
- **Messaggi privati** tra personaggi, con contatore dei non letti.
- **Admin:** CRUD di razze, attributi, abilità, formula di tiro, mappe e luoghi; regolamento e ambientazione; gestione utenti, ban e moderazione; override dei testi dell'interfaccia.
- **Temi:** temi a pacchetto, editor visuale dei token con anteprima, import/export zip, scelta del tema da parte del giocatore.
- **Pagine pubbliche:** homepage, regolamento, ambientazione.
- **Installazione:** Docker Compose, wizard di setup al primo avvio, preset di regole.

### Fase 2

Forum o bacheche, gilde e corporazioni (ruoli, candidature), oggetti, inventario ed equipaggiamento, valute, banca e mercato, lavori e stipendi, esperienza e avanzamento.

### Fase 3

Conflitti strutturati, eventi e notizie in gioco, login OAuth, PWA e notifiche push, layout configurabile, override dei componenti nei temi.

### Fase 4

Quest con step e ricompense, meteo (globale e per luogo), sistema di plugin (incluse regole estensibili via codice).

## 3. Architettura

### 3.1 Approccio

Monolite modulare in un monorepo pnpm. Un solo processo Fastify serve API REST, WebSocket e frontend compilato. Alternative scartate:

- **Servizi separati** (API, gateway realtime, frontend, Redis obbligatorio): scala meglio ma complica l'installazione self-hosted.
- **Monolite con SQLite:** configurazione zero, ma la chat con molte scritture concorrenti e il futuro multi-tenant diventano scomodi.

### 3.2 Struttura del repository

```
pbcjs/
├─ apps/
│  ├─ api/            Fastify
│  │  └─ src/modules/{auth,users,characters,rules,world,chat,messages,admin,themes,settings}
│  └─ web/            Vue 3 + Vite + Pinia + Vue Router
│     └─ src/{features/<modulo>, components/ui, layouts, stores, theme}
├─ packages/
│  ├─ shared/         schemi TypeBox, tipi DTO, eventi WebSocket
│  ├─ dice/           formula → AST → risultato (puro)
│  └─ theme/          schema theme.json, validatore, token → CSS variables
├─ presets/           preset di regole in JSON
├─ themes/default/    tema base (theme.json + assets)
├─ docker/            Dockerfile, compose.yml, compose.dev.yml
└─ docs/
```

### 3.3 Moduli backend

Ogni modulo è un plugin Fastify con livelli `routes → service → repository`:

- **routes:** validano input e output con schemi TypeBox da `packages/shared`.
- **service:** contiene la logica di dominio.
- **repository:** unico livello che usa Drizzle.

I moduli comunicano solo tramite i servizi (iniettati con `fastify.decorate` o un container leggero), mai accedendo ai repository di altri moduli.

### 3.4 Modello dati (MVP)

Database: PostgreSQL, ORM Drizzle, migrazioni versionate.

| Tabella | Contenuto |
|---|---|
| `users` | email, hash della password, stato, ban |
| `roles`, `permissions`, `role_permissions`, `user_roles` | ruoli e permessi a grana fine (es. `chat.master`, `admin.world.edit`) |
| `sessions` | store delle sessioni |
| `characters` | utente, nome (unico), razza, avatar, bio, background, punti disponibili, stato |
| `rule_attributes` | attributi definiti dall'admin (nome, min, max) |
| `rule_skills` | abilità, legate a un attributo |
| `races` | razze, con bonus agli attributi in JSON |
| `rule_settings` | formula di tiro, punti alla creazione |
| `character_attributes`, `character_skills` | valori assegnati al personaggio |
| `maps`, `locations` | mappe; luoghi con posizione sulla mappa, tipo (pubblico, privato, su invito), descrizione, immagine |
| `location_invites` | inviti ai luoghi su invito |
| `chat_messages` | luogo, personaggio, tipo (`speech`, `action`, `whisper`, `master`, `npc`, `roll`, `system`), testo, destinatario, risultato del tiro in JSON, timestamp |
| `private_conversations`, `private_messages` | messaggi privati tra personaggi, stato di lettura |
| `settings` | chiave/valore JSON (nome del gioco, limite personaggi, tema di default, ecc.) |
| `themes` | id, nome, attivo, selezionabile, token in JSON, percorso degli asset |
| `i18n_overrides` | override dei testi dell'interfaccia |

**Predisposizione multi-tenant:** nessuna colonna `game_id` nell'MVP. Tutta la configurazione di gioco vive nel DB e viene letta tramite `SettingsService`, mai da costanti nel codice, così aggiungere `game_id` in futuro è una migrazione meccanica.

### 3.5 Autenticazione

Sessione su cookie httpOnly con `@fastify/session` e store in Postgres, protezione CSRF sulle mutation. Niente JWT: l'app è su un solo dominio. Password con argon2.

## 4. Chat realtime

### 4.1 Trasporto

- Endpoint `/ws` con `@fastify/websocket`, autenticato con il cookie di sessione durante l'handshake.
- Il client entra nel canale `location:<id>` quando accede a un luogo.
- Eventi tipizzati in `packages/shared`:
  - client → server: `location.join`, `location.leave`, `chat.send`, `typing`
  - server → client: `chat.message`, `presence.update`, `typing`, `error`

### 4.2 Flusso di un messaggio

1. Il client invia `chat.send` con `{ type, text, target?, roll? }`.
2. `ChatService` valida l'input, controlla i permessi (`master` e `npc` richiedono `chat.master`), applica il rate limit per socket.
3. Per i tiri, `RulesService.roll(character, skill)` compone la formula con i valori del personaggio e la valuta con `packages/dice`.
4. Il messaggio viene salvato in `chat_messages`, poi pubblicato sul canale.
5. I sussurri vengono consegnati solo a mittente, destinatario e master presenti nel luogo.

### 4.3 Broker

Interfaccia `ChatBroker` (publish/subscribe per canale). MVP: `InMemoryBroker`. Futuro: `RedisBroker` per più istanze, senza modifiche a `ChatService`.

### 4.4 Presenze

Mappa in memoria personaggio → luogo, pubblicata con `presence.update`. Heartbeat ogni 30 secondi; dopo 90 secondi senza heartbeat il personaggio esce dal luogo.

### 4.5 Storico ed export

- Storico via REST: `GET /api/locations/:id/messages?before=<cursor>`, paginato a cursore.
- Export: `GET /api/locations/:id/export?from=&to=` restituisce un file `.md`:
  - front-matter YAML con luogo, intervallo e partecipanti;
  - una riga per messaggio con orario, nome e testo;
  - azioni in corsivo, messaggi master in blockquote, tiri con formula, dettaglio dei dadi e totale;
  - i sussurri sono inclusi solo se chi esporta è mittente, destinatario o master.

## 5. Motore dadi (`packages/dice`)

- **Sintassi:** `NdM`, `+ - * /`, parentesi, `{variabile}`, `min()`, `max()`, keep highest/lowest (`4d6kh3`, `2d20kl1`).
- **Esecuzione:** parser → AST → valutatore scritto da zero. Nessun `eval`, quindi nessuna formula può eseguire codice.
- **Limiti:** massimo 100 dadi per tiro e 1000 facce per dado, per evitare abusi.
- **Casualità:** `crypto.randomInt`, sorgente iniettabile per i test.
- **Output:** `{ total, formula, resolved, rolls: [{ die, results, kept }] }`, salvato nel messaggio di chat, così ogni tiro resta verificabile nello storico.
- **API admin:** endpoint di validazione per l'editor della formula, con errori di sintassi posizionali e anteprima di un tiro.

## 6. Sistema di temi

### 6.1 Formato

```
my-theme/
├─ theme.json      metadati + token
├─ custom.css      opzionale, override avanzati
└─ assets/         logo, sfondi, icone, font
```

```json
{
  "id": "dark-fantasy",
  "name": "Dark Fantasy",
  "version": "1.0.0",
  "tokens": {
    "color": {
      "bg": "#14110f", "surface": "#221c18", "text": "#e8dcc8",
      "primary": "#b8862b", "chat-action": "#c9a96e", "chat-master": "#8fb3d9"
    },
    "font": { "body": "Lora", "heading": "Cinzel", "chat": "Lora" },
    "radius": { "base": "4px" },
    "image": { "logo": "assets/logo.png", "background": "assets/bg.jpg" }
  },
  "layout": null,
  "components": null
}
```

`layout` e `components` sono campi riservati, ignorati nell'MVP, usati in fase 3 per layout configurabile e override dei componenti.

### 6.2 Funzionamento

- Lo schema di `theme.json` è definito e validato in `packages/theme` con TypeBox.
- I token diventano CSS variables (`--pbc-color-bg`, `--pbc-font-body`, ...) iniettate in `:root`. I token mancanti ereditano dal tema `default`.
- I componenti Vue usano solo CSS variables. Una regola stylelint vieta colori fissi nei componenti.
- `custom.css` viene caricato dopo i token. Le classi stabili (`.pbc-chat`, `.pbc-message--action`, `.pbc-sheet`, ...) sono documentate come API pubblica dei temi.
- I font possono essere nomi Google Fonts o file in `assets/`.

### 6.3 Editor visuale (admin)

- Color picker, selettori dei font, upload delle immagini.
- Anteprima live su pagine campione: chat, scheda personaggio, mappa.
- Salva lo stesso `theme.json`; import ed export come zip; duplicazione di un tema esistente.

### 6.4 Più temi

L'admin sceglie il tema di default e quali temi sono selezionabili. Il giocatore sceglie il proprio tema dal profilo. Il tema `default` è incluso e non cancellabile.

### 6.5 Sicurezza

- Upload zip: limite di dimensione, solo tipi ammessi (immagini, font, css, json), controllo dei percorsi contro il path traversal.
- `custom.css`: rimozione di `@import` e di `url()` verso domini esterni, che permetterebbero di tracciare i giocatori.

## 7. Rilascio, installazione, configurazione

### 7.1 Immagine Docker

- Build multi-stage: compilazione di `web`, `api` e package; immagine finale `node:22-alpine` con solo `dist` e dipendenze di produzione.
- Fastify serve `/api/*`, `/ws` e il frontend con `@fastify/static`, con fallback SPA su `index.html`.
- La CI pubblica l'immagine su GHCR con tag semver (`1.2.0`, `1.2`, `latest`) a ogni tag git.

### 7.2 Installazione

```
curl -O <repo>/compose.yml && curl -O <repo>/.env.example
cp .env.example .env   # password DB, SESSION_SECRET, PUBLIC_URL
docker compose up -d
```

- `compose.yml`: servizi `app` e `postgres`, volumi `pgdata` e `data` (temi caricati, upload, export, backup).
- Al primo avvio le migrazioni partono in automatico. Se non esiste un admin, il wizard `/setup` chiede account admin, nome del gioco e preset di regole, poi si blocca.

### 7.3 Preset di regole

Pacchetti JSON in `presets/` con attributi, abilità, razze e formula (es. `fantasy-classico`, `narrativo-leggero`). Il wizard ne importa uno per partire con un gioco subito giocabile.

### 7.4 Configurazione

- **Variabili d'ambiente:** solo infrastruttura e segreti (DB, `SESSION_SECRET`, `PUBLIC_URL`, SMTP, livello di log).
- **DB (`settings`):** tutta la configurazione di gioco, modificabile dall'admin.

### 7.5 Aggiornamenti e backup

- Aggiornamento: `docker compose pull && docker compose up -d`. Migrazioni solo in avanti, eseguite all'avvio, precedute da un backup automatico `pg_dump` in `data/backups`.
- `pbc backup` (CLI nel container, anche dal pannello admin): archivio con dump del DB e cartella `data`. `pbc restore` ripristina.

### 7.6 Sviluppo

`pnpm dev` avvia api (tsx watch) e web (Vite). `compose.dev.yml` avvia solo Postgres. Script `seed` con dati demo.

## 8. Errori, sicurezza, i18n

### 8.1 Errori

- Classi di dominio: `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`.
- Error handler centrale Fastify: risposte `{ code, message, details? }` con codici stabili (es. `CHARACTER_NAME_TAKEN`), tradotti dal frontend con i18n.
- WebSocket: evento `error` con lo stesso formato; la connessione non viene chiusa per errori applicativi.
- Log pino JSON con request id. In produzione nessun dettaglio interno arriva al client.

### 8.2 Sicurezza

- Rate limit su login, registrazione e chat (`@fastify/rate-limit` e limite per socket).
- Markdown renderizzato con markdown-it senza HTML, poi sanitizzato con DOMPurify sul client.
- CSRF sulle mutation REST, CSP restrittiva, `@fastify/helmet`.
- Permessi sempre verificati lato server con `requirePermission('<permesso>')` sulle rotte.

### 8.3 i18n

Tutti i testi dell'interfaccia passano da vue-i18n; italiano come lingua base, inglese come seconda. L'admin può sovrascrivere i testi chiave tramite `i18n_overrides`.

## 9. Test e qualità

- **Unit (Vitest):** `packages/dice` con casualità iniettata e property-based testing (fast-check); `packages/theme` (validazione, generazione CSS, sanitizzazione); servizi di dominio con repository finti.
- **Integrazione API:** Vitest + `fastify.inject`, Postgres reale con Testcontainers, migrazioni per suite e rollback per test.
- **WebSocket:** client `ws` reali contro un server di test (join, messaggi, sussurri visibili solo ai destinatari, permessi master).
- **Frontend:** Vitest + Vue Test Utils sui componenti; Playwright E2E sui flussi chiave (setup, registrazione, creazione personaggio, chat tra due browser, cambio tema).
- **Smoke Docker in CI:** build dell'immagine, `compose up`, healthcheck, setup.
- **Qualità:** TypeScript strict, ESLint, Prettier, stylelint; lint-staged sui soli file modificati; CI GitHub Actions con lint, test, build, immagine a ogni tag.

## 10. Roadmap

Ogni step produce un risultato funzionante e testato, con spec e piano di implementazione propri.

### Fase 1 — MVP

| Step | Contenuto | Risultato verificabile |
|---|---|---|
| 0 | Fondamenta: monorepo, TypeScript, lint, CI, Fastify con healthcheck, shell Vue, Drizzle e Postgres, Docker dev e prod, token base del tema default | `docker compose up` mostra la shell e `/api/health` risponde ok |
| 1 | `packages/dice` e `packages/theme` | librerie con test completi, CLI di prova per i tiri |
| 2 | Auth e utenti: registrazione, login, sessione, reset password via SMTP, ruoli e permessi, wizard `/setup` | creazione dell'admin, login e logout, rotte protette |
| 3 | Regole: CRUD admin di attributi, abilità e razze, formula con anteprima, import dei preset | preset `fantasy-classico` importato, tiro di prova dall'admin |
| 4 | Personaggi: creazione guidata, limite per account, scheda pubblica, selezione del personaggio attivo | un utente crea 2 personaggi, scheda visibile |
| 5 | Mondo: mappe, luoghi pubblici, privati e su invito, CRUD admin, mappa cliccabile | navigazione mappa → luogo |
| 6 | Chat realtime: WebSocket, presenze, tipi di messaggio, sussurri, master e PNG, tiri, storico, export Markdown | due browser giocano nello stesso luogo, export `.md` |
| 7 | Messaggi privati | conversazione tra personaggi, contatore dei non letti |
| 8 | Temi: caricamento token, upload zip, editor visuale con anteprima, scelta del giocatore | tema creato e attivato dall'editor senza scrivere codice |
| 9 | Admin e moderazione: ban, gestione utenti, regolamento e ambientazione, pagine pubbliche, override dei testi | homepage pubblica con regolamento e ambientazione |
| 10 | Rilascio: immagine GHCR, backup e restore, documentazione per gestori e per autori di temi, E2E completi | release `v0.1.0` installabile da zero seguendo il README |

**Dipendenze:** 0 → (1 ∥ 2) → 3 → 4 → 5 → 6 → (7 ∥ 8 ∥ 9) → 10.

### Fasi successive

- **Fase 2:** forum o bacheche, gilde, oggetti, inventario ed equipaggiamento, valute, banca e mercato, lavori e stipendi, esperienza e avanzamento.
- **Fase 3:** conflitti strutturati, eventi e notizie, OAuth, PWA e notifiche push, layout configurabile, override dei componenti.
- **Fase 4:** quest con step e ricompense, meteo, sistema di plugin.
