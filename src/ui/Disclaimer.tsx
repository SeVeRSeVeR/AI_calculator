import { ru } from '../i18n/ru';

export function Disclaimer() {
  return (
    <p className="disclaimer" role="note">
      <span aria-hidden="true">⚠</span> {ru.disclaimer}
    </p>
  );
}
