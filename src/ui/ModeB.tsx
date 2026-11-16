import { useMemo } from 'react';
import { PROFILE_SETTINGS } from '../calc/core';
import type { Recommendation } from '../calc/configs';
import { engineForQuant } from '../data/loader';
import { useAppStore } from '../state/store';
import { validateModeB } from '../state/validation';
import { PROFILES } from '../state/forms';
import { ru } from '../i18n/ru';
import { num, tokens } from './format';
import { ConfigCard } from './ConfigCard';
import { ValidatedInput } from './ValidatedInput';

const PROFILE_LABELS: Record<(typeof PROFILES)[number], string> = {
  chat: 'Чат',
  rag: 'RAG / длинный контекст',
  code: 'Код / агенты',
  batch: 'Пакетная обработка',
};

export function ModeB() {
  const catalog = useAppStore((state) => state.catalog);
  const b = useAppStore((state) => state.b);
  const setB = useAppStore((state) => state.setB);
  const attempted = useAppStore((state) => state.attempted);
  const resultB = useAppStore((state) => state.resultB);
  const calculate = useAppStore((state) => state.calculate);
  const applyBPatch = useAppStore((state) => state.applyBPatch);

  const model = catalog?.models.find((item) => item.id === b.modelId);
  const validation = useMemo(
    () => (catalog ? validateModeB(b, catalog, model) : { errors: {}, warnings: {}, valid: false }),
    [b, catalog, model],
  );

  if (!catalog) return null;

  const engine = engineForQuant(catalog, b.quantId);
  const dense = catalog.models
    .filter((item) => !item.moe && item.status === 'released')
    .sort((x, y) => x.params_total_b - y.params_total_b);
  const moe = catalog.models
    .filter((item) => item.moe && item.status === 'released')
    .sort((x, y) => x.params_total_b - y.params_total_b);

  const visibleError = (field: string, value: unknown): string | undefined => {
    if (!validation.errors[field]) return undefined;
    if (attempted) return validation.errors[field];
    return value === '' || value === undefined ? undefined : validation.errors[field];
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    calculate();
  };

  const applyRecommendation = (recommendation: Recommendation) => {
    applyBPatch(recommendation.patch);
  };

  return (
    <div className="layout">
      <section className="panel form-panel" aria-labelledby="mode-b-form-title">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Режим B</span>
            <h2 id="mode-b-form-title">От модели к железу</h2>
          </div>
          <p>Выберите модель — получите три конфигурации с числовыми критериями.</p>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="model">Модель</label>
            <select
              id="model"
              value={b.modelId}
              aria-invalid={visibleError('modelId', b.modelId) ? true : undefined}
              aria-describedby={visibleError('modelId', b.modelId) ? 'model-error' : 'model-hint'}
              onChange={(event) => setB({ modelId: event.target.value })}
            >
              <option value="">Выберите модель</option>
              <optgroup label="Dense">
                {dense.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {num(item.params_total_b, 1)}B · {tokens(item.max_context)} ctx
                  </option>
                ))}
              </optgroup>
              <optgroup label="MoE">
                {moe.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {num(item.params_total_b, 1)}B total / {num(item.params_active_b, 1)}B active · {tokens(item.max_context)} ctx
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="field-hint" id="model-hint">
              {model
                ? `${model.vendor} · ${model.n_layers} слоёв · ${model.n_kv_heads} KV-heads · head_dim ${model.head_dim} · ${model.license}`
                : 'Для MoE память считается по total, скорость — по active параметрам.'}
            </p>
            {visibleError('modelId', b.modelId) ? <p className="field-error" id="model-error" role="alert">{visibleError('modelId', b.modelId)}</p> : null}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="quant-b">Квантизация</label>
              <select
                id="quant-b"
                value={b.quantId}
                onChange={(event) => setB({ quantId: event.target.value })}
              >
                <optgroup label="GPU-сервер (vLLM)">
                  {catalog.quantizations.filter((item) => item.family === 'gpu').map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
                <optgroup label="GGUF (llama.cpp)">
                  {catalog.quantizations.filter((item) => item.family === 'gguf').map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
              </select>
              <p className="field-hint">
                Движок выбирается автоматически: <strong>{engine.name}</strong>. {engine.offload_supported ? 'Offload доступен.' : 'Без offload.'}
              </p>
            </div>
            <div className="field">
              <label htmlFor="profile-b">Профиль нагрузки</label>
              <select
                id="profile-b"
                value={b.profile}
                onChange={(event) => setB({ profile: event.target.value as typeof b.profile })}
              >
                {PROFILES.map((profile) => (
                  <option key={profile} value={profile}>{PROFILE_LABELS[profile]}</option>
                ))}
              </select>
              <p className="field-hint">Рекомендуемый темп: {PROFILE_SETTINGS[b.profile].targetToks} tok/s.</p>
            </div>
          </div>

          <div className="field-row">
            <ValidatedInput
              id="context-b"
              label="Окно контекста, токенов"
              value={b.context}
              min={1}
              max={model?.max_context ?? 1_000_000}
              onChange={(value) => setB({ context: value })}
              error={visibleError('context', b.context)}
              warning={b.context !== '' && Number(b.context) < 512 ? validation.warnings.context : undefined}
              hint={model ? `Максимум модели: ${model.max_context.toLocaleString('ru-RU')}` : 'Сначала выберите модель'}
            />
            <ValidatedInput
              id="users-b"
              label="Одновременных пользователей"
              value={b.users}
              min={1}
              max={10_000}
              onChange={(value) => setB({ users: value })}
              error={visibleError('users', b.users)}
              warning={b.users !== '' && Number(b.users) > 1000 ? validation.warnings.users : undefined}
              hint="1–10 000"
            />
          </div>

          <ValidatedInput
            id="target-b"
            label="Целевой tok/s на пользователя"
            value={b.targetToks}
            min={1}
            max={1000}
            onChange={(value) => setB({ targetToks: value })}
            error={visibleError('targetToks', b.targetToks)}
            hint="По умолчанию 15 tok/s; OPTIMAL обязан обеспечить этот темп."
          />

          {model ? (
            <div className="model-summary">
              <strong>{model.name}</strong>
              <span>
                {num(model.params_total_b, 1)}B total · {num(model.params_active_b, 1)}B active ·{' '}
                {tokens(model.max_context)} ctx · {model.license} ·{' '}
                {model.commercial_ok ? 'коммерческое использование разрешено' : 'коммерческое использование ограничено'}
              </span>
              <a href={model.geometry_source} target="_blank" rel="noreferrer noopener">
                config.json на Hugging Face
              </a>
            </div>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="button button--primary" disabled={!validation.valid}>
              {ru.actions.calculate}
            </button>
            {!validation.valid ? (
              <span className="muted">Заполните обязательные поля корректно.</span>
            ) : (
              <span className="muted">
                {model?.name} · {engine.name} · {validation.valid ? 'готово к расчёту' : ''}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="results" aria-labelledby="mode-b-results-title">
        <div className="results-head">
          <div>
            <span className="eyebrow">Результат</span>
            <h2 id="mode-b-results-title">Три конфигурации</h2>
          </div>
        </div>

        {resultB ? (
          resultB.status === 'IMPOSSIBLE' ? (
            <div className="impossible" role="status">
              <span className="badge badge--bad">IMPOSSIBLE</span>
              <h3>{ru.states.impossible}</h3>
              <p>{resultB.reason}</p>
              <p className="muted">
                KV-кеш нельзя выгрузить в RAM без потери смысла конфигурации, а веса при offload ограничены 40–50%.
              </p>
              {resultB.recommendations.length > 0 ? (
                <div className="recommendations">
                  <h4>Что можно изменить</h4>
                  {resultB.recommendations.map((recommendation) => (
                    <button
                      key={`${recommendation.kind}-${recommendation.label}`}
                      type="button"
                      className="recommendation"
                      onClick={() => applyRecommendation(recommendation)}
                    >
                      <strong>{recommendation.label}</strong>
                      <span>{recommendation.description}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {resultB.min ? (
                <p className="muted">
                  Минимальная конфигурация существует ({resultB.min.gpuCount} × {resultB.min.gpu.name}), но
                  оптимальная с полным размещением в VRAM — нет.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="summary summary--b" aria-live="polite">
                <div className="summary-main">
                  <strong>{resultB.maxEqualsOptimal ? '2' : '3'}</strong>
                  <span>конфигурации{resultB.maxEqualsOptimal ? ' (MAX не требуется)' : ''}</span>
                </div>
                <dl className="summary-specs">
                  <div><dt>Модель</dt><dd>{resultB.model.name}</dd></div>
                  <div><dt>Квантизация</dt><dd>{resultB.quant.name}</dd></div>
                  <div><dt>Движок</dt><dd>{resultB.engine.name}</dd></div>
                  <div><dt>Контекст</dt><dd>{tokens(resultB.contextTokens)}</dd></div>
                  <div><dt>Пользователи</dt><dd>{resultB.users}</dd></div>
                  <div><dt>Цель</dt><dd>{resultB.targetToks} tok/s</dd></div>
                </dl>
              </div>

              <div className="cards cards--configs">
                {resultB.min ? <ConfigCard config={resultB.min} /> : null}
                {resultB.optimal ? <ConfigCard config={resultB.optimal} collapsed={resultB.maxEqualsOptimal} /> : null}
                {resultB.max ? <ConfigCard config={resultB.max} /> : null}
              </div>

              {resultB.maxEqualsOptimal ? (
                <p className="notice notice--info" role="note">
                  <strong>MAX не требуется.</strong> Оптимальная конфигурация уже покрывает рост: каталог не
                  содержит более крупной совместимой сборки или двукратный параллелизм достигается на ней же.
                </p>
              ) : null}
            </>
          )
        ) : (
          <div className="empty-state empty-state--intro" role="status">
            <h3>Пока ничего не рассчитано</h3>
            <p>{ru.states.emptyB}</p>
            <p className="muted">
              MIN допускает offload до 40%, OPTIMAL — 100% в VRAM с запасом 15–30%, MAX — рост ×1.5 по VRAM.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
