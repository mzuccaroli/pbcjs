import type { HealthResponse } from '@pbcjs/shared'

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health')
  if (res.status !== 200 && res.status !== 503) {
    throw new Error(`Unexpected status ${res.status}`)
  }
  return (await res.json()) as HealthResponse
}
