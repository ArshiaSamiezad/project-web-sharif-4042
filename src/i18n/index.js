/**
 * App i18n — for new pages:
 *   import { useI18n } from '../i18n/I18nProvider'
 *   const { t, formatNumber, subscriptionLabel, genderLabel } = useI18n()
 *   // then: t('section.key') or t('section.key', { name: '…' })
 * Add matching keys to both `fa` and `en` in translations.js
 */
export { I18nProvider, useI18n, applyDocumentLanguage } from './I18nProvider'
export {
  t,
  formatNumber,
  getLanguage,
  setLanguage,
  subscriptionLabel,
  genderLabel,
} from './translations'
