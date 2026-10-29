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

  it.each([
    'background: url("ht\ttps://evil.example/t.png")',
    'background: url("/\t/evil.example/t.png")',
    'background: url("\x01https://evil.example/t.png")',
    'background: url("\x1f//evil.example/t.png")',
    'background-image: image-set("ht\ttps://evil.example/a.png" 1x)',
    'background: src("https://evil.example/t.png")',
    'background: expression (alert(1))',
  ])('removes the declaration hidden from naive parsing %j', (declaration) => {
    const result = sanitizeCustomCss(`.a { color: red; ${declaration}; }`)
    expect(result.removed).toEqual([declaration])
    expect(result.css).toContain('color: red')
    expect(result.css).not.toContain('evil.example')
    expect(result.css).not.toContain('expression')
  })

  it.each(['background: url("img/a.png")', 'background: url(data:image/png;base64,AAAA)'])(
    'keeps the safe declaration %j',
    (declaration) => {
      const result = sanitizeCustomCss(`.a { ${declaration}; }`)
      expect(result.removed).toEqual([])
      expect(result.css).toContain(declaration)
    },
  )

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
