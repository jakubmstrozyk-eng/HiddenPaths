import { useT } from './i18n';

/** "Back" as an arrow in the top left corner of the screen (Jacob, 2026-11-27). */
export function BackArrow({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <button className="back-arrow" onClick={onClick} aria-label={t('back')} title={t('back')}>
      <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="square" /></svg>
    </button>
  );
}
