<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="pbc-home">
    <h1>{{ t('app.title') }}</h1>
    <p>{{ t('app.subtitle') }}</p>
  </section>
</template>
