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
