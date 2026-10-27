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
