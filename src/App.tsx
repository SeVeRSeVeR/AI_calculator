import { useEffect, useRef, useState } from 'react';
import { CALC_VERSION } from './calc/core';
import { ru } from './i18n/ru';
import { useAppStore } from './state/store';
import { Disclaimer } from './ui/Disclaimer';
import { ModeA } from './ui/ModeA';
import { ModeB } from './ui/ModeB';

const repo = __REPO_URL__.replace(/\/$/, '');

function docHref(file: string): string {
  if (repo) return `${repo}/blob/main/${file}`;
  return `${import.meta.env.BASE_URL}docs/${file}`;
}

export function App() {
  const status = useAppStore((state) => state.status);
  const error = useAppStore((state) => state.error);
  const catalog = useAppStore((state) => state.catalog);
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const load = useAppStore((state) => state.load);
  const resetAll = useAppStore((state) => state.resetAll);
  const getShareUrl = useAppStore((state) => state.getShareUrl);
  const notice = useAppStore((state) => state.notice);
  const dismissNotice = useAppStore((state) => state.dismissNotice);

  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
  };

  const copyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast(ru.states.copied);
      window.history.replaceState(null, '', url);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(ru.states.copied);
        window.history.replaceState(null, '', url);
      } catch {
        showToast(ru.states.copyFailed);
      }
    }
  };

  const reset = () => {
    if (window.confirm('Сбросить все параметры, сохранённое состояние и query-ссылку?')) {
      resetAll();
      showToast('Состояние сброшено');
    }
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">К содержимому</a>

      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">λ</span>
          <div>
            <h1>{ru.appTitle}</h1>
            <p>{ru.appSubtitle} · VRAM, KV-кеш, скорость, платформа</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="button button--ghost" onClick={copyLink}>
            {ru.actions.copyLink}
          </button>
          <button type="button" className="button button--ghost" onClick={reset}>
            {ru.actions.reset}
          </button>
        </div>
      </header>

      <nav className="mode-tabs" aria-label="Режим расчёта" role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-a"
          aria-selected={mode === 'a'}
          aria-controls="panel-a"
          className={`mode-tab${mode === 'a' ? ' active' : ''}`}
          onClick={() => setMode('a')}
        >
          <span className="mode-tab-kicker">Режим A</span>
          <span>От железа к модели</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-b"
          aria-selected={mode === 'b'}
          aria-controls="panel-b"
          className={`mode-tab${mode === 'b' ? ' active' : ''}`}
          onClick={() => setMode('b')}
        >
          <span className="mode-tab-kicker">Режим B</span>
          <span>От модели к железу</span>
        </button>
      </nav>

      <main id="main">
        {status === 'loading' || status === 'idle' ? (
          <div className="panel loading-panel" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>{ru.states.catalogLoading}</p>
          </div>
        ) : status === 'error' ? (
          <div className="panel error-panel" role="alert">
            <h2>{ru.states.catalogError}</h2>
            <p>{error}</p>
            <p className="muted">
              Проверьте, что файлы <code>data/*.v1.json</code> доступны по относительному пути. Кнопка ниже
              повторит загрузку.
            </p>
            <button type="button" className="button button--primary" onClick={() => void load()}>
              {ru.actions.retry}
            </button>
          </div>
        ) : mode === 'a' ? (
          <div id="panel-a" role="tabpanel" aria-labelledby="tab-a">
            <ModeA />
          </div>
        ) : (
          <div id="panel-b" role="tabpanel" aria-labelledby="tab-b">
            <ModeB />
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="footer-meta">
          <span>Каталог v{catalog?.catalogVersion ?? '—'}</span>
          <span>Формулы calc v{CALC_VERSION}</span>
          <span>Сборка {__BUILD_DATE__}</span>
          <span>Дата сбора каталога: {catalog?.collectedAt ?? '—'}</span>
        </div>
        <nav className="footer-links" aria-label="Документация">
          <a href={docHref('README.md')}>README</a>
          <a href={docHref('ASSUMPTIONS.md')}>ASSUMPTIONS</a>
          <a href={docHref('DATA_SOURCES.md')}>DATA_SOURCES</a>
          <a href={docHref('LICENSE')}>MIT License</a>
          {repo ? <a href={repo}>Репозиторий</a> : null}
        </nav>
        <Disclaimer />
      </footer>

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {notice ? (
          <div className="toast toast--warn">
            <span>{notice}</span>
            <button type="button" aria-label="Закрыть уведомление" onClick={dismissNotice}>×</button>
          </div>
        ) : null}
        {toast ? (
          <div className="toast">
            <span>{toast}</span>
            <button type="button" aria-label="Закрыть уведомление" onClick={() => setToast(null)}>×</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
