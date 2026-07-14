import './PrivacyModal.css'

const POLICY_TEXT = `سیاست حریم خصوصی Sepatify

با ثبت‌نام در سپتیفای، موافقت می‌کنید که اطلاعات حساب شما (از جمله ایمیل، نام نمایشی و ترجیحات) صرفاً برای ارائه خدمات پخش موسیقی و بهبود تجربه کاربری نگهداری شود.

ما اطلاعات شما را به اشخاص ثالث نمی‌فروشیم. در فاز فعلی داده‌ها به‌صورت آزمایشی در مرورگر شما (Local Storage) ذخیره می‌شوند و به سرور ارسال نمی‌گردند.

می‌توانید در هر زمان درخواست حذف حساب خود را از بخش تنظیمات ارسال کنید.`

export default function PrivacyModal({ open, onClose }) {
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
        <h2 id="privacy-title">سیاست حریم خصوصی</h2>
        <div className="privacy-modal__body">
          {POLICY_TEXT.split('\n').map((line, i) =>
            line.trim() ? <p key={i}>{line}</p> : <br key={i} />,
          )}
        </div>
        <button type="button" className="privacy-modal__close" onClick={onClose}>
          بستن
        </button>
      </div>
    </div>
  )
}
