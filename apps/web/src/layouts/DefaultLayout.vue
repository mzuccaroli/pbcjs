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
