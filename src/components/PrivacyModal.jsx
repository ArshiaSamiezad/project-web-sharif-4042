import { useI18n } from '../i18n/I18nProvider'
import './PrivacyModal.css'

export default function PrivacyModal({ open, onClose }) {
  const { t } = useI18n()

  if (!open) return null

  return (
    <div className="privacy-modal" role="presentation" onClick={onClose}>
      <div
        className="privacy-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="privacy-title">{t('auth.privacyTitle')}</h2>
        <div className="privacy-modal__body">
          {t('auth.privacyBody')
            .split('\n')
            .map((line, i) => (line.trim() ? <p key={i}>{line}</p> : <br key={i} />))}
        </div>
        <button type="button" className="privacy-modal__close" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}
