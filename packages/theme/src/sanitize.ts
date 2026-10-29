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
// C0 controls and space are exactly what the URL parser strips at the ends
// eslint-disable-next-line no-control-regex
const EDGE_CONTROLS = /^[\x00-\x20]+|[\x00-\x20]+$/g
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
    if (node.type === 'word') {
      // `expression (` parses as a word followed by an anonymous paren group
      if (node.value.toLowerCase() === 'expression') unsafe = true
      return
    }
    if (node.type !== 'function') return
    const name = node.value.toLowerCase()
    if (name === 'expression') {
      unsafe = true
    } else if (name === 'url' || name === 'src') {
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
  // Browsers resolve urls with the WHATWG parser: tab/LF/CR vanish anywhere and
  // leading/trailing C0 controls and spaces are stripped, so test what they see.
  const trimmed = url.replace(/[\t\n\r]/g, '').replace(EDGE_CONTROLS, '')
  if (SAFE_DATA_URL.test(trimmed)) return false
  return trimmed.startsWith('//') || HAS_SCHEME.test(trimmed)
}
