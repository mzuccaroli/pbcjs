import { writeFile } from 'node:fs/promises'
import { renderDefaultTokensCss, TOKENS_CSS_PATH } from './default-tokens'

await writeFile(TOKENS_CSS_PATH, await renderDefaultTokensCss())
console.log(`Wrote ${TOKENS_CSS_PATH}`)
