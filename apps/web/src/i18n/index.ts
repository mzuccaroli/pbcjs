import { createI18n } from 'vue-i18n'
import it from './it'
import en from './en'

export const i18n = createI18n({
  legacy: false,
  locale: 'it',
  fallbackLocale: 'it',
  messages: { it, en },
})
