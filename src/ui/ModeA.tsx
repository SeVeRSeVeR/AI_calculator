import { useMemo } from 'react';
import { multiGpuAdvice } from '../calc/fit';
import { recommendPlatform } from '../calc/platform';
import { quantizationsForEngine } from '../data/loader';
import type { ModelEvaluation } from '../calc/fit';
import { useAppStore } from '../state/store';
import { validateModeA } from '../state/validation';
import { PROFILES } from '../state/forms';
import { ru } from '../i18n/ru';
import { gb, num, tokens } from './format';
import { ModelCard } from './ModelCard';
import { PlatformPanel } from './PlatformPanel';
import { ValidatedInput } from './ValidatedInput';

const PROFILE_LABELS: Record<(typeof PROFILES)[number], string> = {
  chat: 'Чат',
  rag: 'RAG',
  code: 'Код / агенты',
  batch: 'Batch',
};

export function ModeA() {
  const catalog = useAppStore((state) => state.catalog);
  const a = useAppStore((state) => state.a);
  const setA = useAppStore((state) => state.setA);
  const advanced = useAppStore((state) => state.advanced);
  const setAdvanced = useAppStore((state) => state.setAdvanced);
  const attempted = useAppStore((state) => state.attempted);
  const resultA = useAppStore((state) => state.resultA);
  const selectedModelId = useAppStore((state) => state.selectedModelId);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const calculate = useAppStore((state) => state.calculate);
  const nudgeA = useAppStore((state) => state.nudgeA);

  const catalogReady = Boolean(catalog);
  const validation = useMemo(
    () => (catalog ? validateModeA(a, catalog) : { errors: {}, warnings: {}, valid: false }),
    [a, catalog],
  );

  if (!catalog) return null;

  const engine = catalog.engines.find((item) => item.id === a.engineId);
  const gpu = catalog.gpus.find((item) => item.id === a.gpuId);
  const quant = catalog.quantizations.find((item) => item.id === a.quantId);
  const quants = quantizationsForEngine(catalog, a.engineId);
  const gpus = gpu ? Array.from({ length: Number(a.gpuCount || 1) }, () => gpu) : [];
  const advice = gpus.length > 1 && engine ? multiGpuAdvice(gpus, engine) : null;
  const fits = resultA?.filter((item) => item.status !== 'NO_FIT') ?? [];
  const noFit = resultA?.filter((item) => item.status === 'NO_FIT') ?? [];
  const selected = resultA?.find((item) => item.model.id === selectedModelId) ?? null;

  const platform = selected
    ? recommendPlatform({
        gpus,
        cpus: catalog.cpus,
        weightsGb: selected.full.weightsGb,
        weightsOffloadedGb: selected.weightsOffloadedGb,
        offloadRatio: selected.offloadRatio,
        unifiedMemory: gpu?.unified_memory,
      })
    : null;

  const visibleError = (field: string, value: unknown): string | undefined => {
    if (!validation.errors[field]) return undefined;
    if (attempted) return validation.errors[field];
    return value === '' || value === undefined ? undefined : validation.errors[field];
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    calculate();
  };

  const first = resultA?.[0];
  const fullCount = resultA?.filter((item) => item.status === 'FITS_FULL').length ?? 0;
  const tightCount = resultA?.filter((item) => item.status === 'FITS_TIGHT').length ?? 0;
  const ramCount = resultA?.filter((item) => item.status === 'FITS_WITH_RAM').length ?? 0;

  return (
    <div className="layout">
      <section className="panel form-panel" aria-labelledby="mode-a-form-title">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Режим A</span>
            <h2 id="mode-a-form-title">От железа к модели</h2>
          </div>
          <p>Задайте сервер и нагрузку — калькулятор проверит каждую модель каталога.</p>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="gpu">GPU</label>
            <select
              id="gpu"
              value={a.gpuId}
              aria-invalid={visibleError('gpuId', a.gpuId) ? true : undefined}
              aria-describedby={visibleError('gpuId', a.gpuId) ? 'gpu-error' : 'gpu-hint'}
              onChange={(event) => setA({ gpuId: event.target.value })}
            >
              <option value="">Выберите GPU</option>
              <optgroup label="Consumer">
                {catalog.gpus.filter((item) => item.class === 'consumer').filter((item) => item.name.toLowerCase().includes(a.gpuFilter?.toLowerCase() ?? '')).length > 0 && catalog.gpus.filter((item) => item.class === 'consumer').filter((item) => item.name.toLowerCase().includes(a.gpuFilter?.toLowerCase() ?? '')).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.vram_gb} ГБ · {item.bandwidth_gbs} ГБ/с · {item.tdp_w} Вт
                  </option>
                ))}
              </optgroup>
              <optgroup label="Workstation / prosumer">
                {catalog.gpus.filter((item) => item.class === 'prosumer').filter((item) => item.name.toLowerCase().includes(a.gpuFilter?.toLowerCase() ?? '')).length > 0 && catalog.gpus.filter((item) => item.class === 'prosumer').filter((item) => item.name.toLowerCase().includes(a.gpuFilter?.toLowerCase() ?? '')).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.vram_gb} ГБ · {item.bandwidth_gbs} ГБ/с · {item.tdp_w} Вт
                  </option>
                ))}
              </optgroup>
              <optgroup label="Datacenter">
                {catalog.gpus.filter((item) => item.class === 'datacenter').filter((item) => item.name.toLowerCase().includes(a.gpuFilter?.toLowerCase() ?? '')).length > 0 && catalog.gpus.filter((item) => item.class === 'datacenter').filter((item) => item.name.toLowerCase().includes(a.gpuFilter?.toLowerCase() ?? '')).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.vram_gb} ГБ · {item.bandwidth_gbs} ГБ/с · {item.tdp_w} Вт
                  </option>
                ))}
              </optgroup>
            </select>
            {/* Фильтр по названию GPU - позволяет быстро найти нужную карту по частичному совпадению имени */}
            <div className="field-row">
              <div className="field">
                <label htmlFor="gpu-filter">Фильтр по названию GPU</label>
                <input
                  id="gpu-filter"
                  type="text"
                  placeholder="Например: RTX 5090, A100 или RX..."
                  value={a.gpuFilter}
                  onChange={(event) => setA({ gpuFilter: event.target.value })}
                />
                <p className="field-hint">Введите часть названия видеокарты для фильтрации списка.</p>
              </div>
            </div>
            <p className="field-hint" id="gpu-hint">
              {gpu
                ? `${gpu.vendor} · ${gpu.vram_gb} ГБ · ${gpu.bandwidth_gbs} ГБ/с · ${gpu.tdp_w} Вт${gpu.unified_memory ? ' · unified memory' : ''}${gpu.rocm_support ? ' · ROCm' : ''}${gpu.xpu_support ? ' · XPU' : ''}`
                : 'VRAM, пропускная способность и TDP берутся из каталога.'}
            </p>
            {visibleError('gpuId', a.gpuId) ? <p className="field-error" id="gpu-error" role="alert">{visibleError('gpuId', a.gpuId)}</p> : null}
          </div>

          <div className="field-row">
            <ValidatedInput
              id="gpu-count"
              label="Количество GPU"
              value={a.gpuCount}
              min={1}
              max={8}
              onChange={(value) => setA({ gpuCount: value })}
              error={visibleError('gpuCount', a.gpuCount)}
              hint="1–8, одинаковые карты"
            />
            <div className="field">
              <label htmlFor="profile">Профиль нагрузки</label>
              <select
                id="profile"
                value={a.profile}
                onChange={(event) => setA({ profile: event.target.value as typeof a.profile })}
              >
                {PROFILES.map((profile) => (
                  <option key={profile} value={profile}>{PROFILE_LABELS[profile]}</option>
                ))}
              </select>
              <p className="field-hint">Влияет на целевой tok/s и эффективность батча.</p>
            </div>
          </div>

          <div className="field-row">
            <ValidatedInput
              id="context"
              label="Окно контекста, токенов"
              value={a.context}
              min={1}
              max={1_048_576}
              onChange={(value) => setA({ context: value })}
              error={visibleError('context', a.context)}
              warning={a.context !== '' && Number(a.context) < 512 ? validation.warnings.context : undefined}
              hint="512–1 048 576; KV-кеш растёт линейно"
            />
            <ValidatedInput
              id="users"
              label="Одновременных пользователей"
              value={a.users}
              min={1}
              max={10_000}
              onChange={(value) => setA({ users: value })}
              error={visibleError('users', a.users)}
              warning={a.users !== '' && Number(a.users) > 1000 ? validation.warnings.users : undefined}
              hint="1–10 000"
            />
          </div>
          <div className="chips" aria-label="Быстрый выбор контекста">
            {[4096, 8192, 32768, 131072, 1048576].map((value) => (
              <button
                key={value}
                type="button"
                className={`chip${Number(a.context) === value ? ' chip--active' : ''}`}
                onClick={() => setA({ context: value })}
              >
                {tokens(value)}
              </button>
            ))}
          </div>

          <div className="field checkbox-field">
            <label htmlFor="dspark-a">
              <input
                id="dspark-a"
                type="checkbox"
                checked={a.useDSpark}
                onChange={(event) => setA({ useDSpark: event.target.checked })}
              />
              <span>DSpark — спекулятивное декодирование</span>
            </label>
            <p className="field-hint">
              Draft-модель подбирается для каждой целевой модели. Ускорение: 1.5× для vLLM/SGLang,
              1.3× для llama.cpp; TGI не поддерживает DSpark.
            </p>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="engine">Движок</label>
              <select
                id="engine"
                value={a.engineId}
                onChange={(event) => setA({ engineId: event.target.value })}
              >
                {catalog.engines.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <p className="field-hint">{engine?.notes}</p>
            </div>
            <div className="field">
              <label htmlFor="quant">Квантизация</label>
              <select
                id="quant"
                value={a.quantId}
                onChange={(event) => setA({ quantId: event.target.value })}
              >
                {quants.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <p className="field-hint">{quant?.description}</p>
            </div>
          </div>

          <details
            className="advanced"
            open={advanced}
            onToggle={(event) => setAdvanced(event.currentTarget.open)}
          >
            <summary>Расширенные параметры</summary>
            <div className="field-row">
              <ValidatedInput
                id="util"
                label="Целевая утилизация VRAM"
                value={a.utilTarget}
                min={0.8}
                max={0.95}
                step={0.01}
                inputMode="decimal"
                placeholder={engine ? String(engine.default_util_target) : '0.90'}
                onChange={(value) => setA({ utilTarget: value })}
                error={visibleError('utilTarget', a.utilTarget)}
                hint={engine ? `По умолчанию ${engine.default_util_target} для ${engine.name}` : undefined}
              />
              <ValidatedInput
                id="target-a"
                label="Целевой tok/s на пользователя"
                value={a.targetToks}
                min={1}
                max={1000}
                placeholder="не задан"
                onChange={(value) => setA({ targetToks: value })}
                error={visibleError('targetToks', a.targetToks)}
                hint="Опционально; используется для пометки моделей"
              />
            </div>
          </details>

          <div className="form-actions">
            <button type="submit" className="button button--primary" disabled={!validation.valid || !catalogReady}>
              {ru.actions.calculate}
            </button>
            {!validation.valid ? (
              <span className="muted">
                Заполните обязательные поля корректно — кнопка станет активной.
              </span>
            ) : (
              <span className="muted">
                {gpus.length} × {gpu?.name ?? 'GPU'} · {quant?.name} · {tokens(Number(a.context))} токенов
                {a.useDSpark ? ' · DSpark' : ''}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="results" aria-labelledby="mode-a-results-title">
        <div className="results-head">
          <div>
            <span className="eyebrow">Результат</span>
            <h2 id="mode-a-results-title">Модели под ваше железо</h2>
          </div>
        </div>

        {advice?.warning ? (
          <div className="notice notice--warn" role="note">
            <strong>{gpus.length} GPU: {advice.interconnect === 'pcie' ? 'PCIe без NVLink' : advice.interconnect}</strong>
            <p>{advice.warning}</p>
            {advice.recommendation ? <p>{advice.recommendation}</p> : null}
          </div>
        ) : null}
        {advice?.recommendation && !advice.warning ? (
          <div className="notice notice--info" role="note">
            <strong>{gpus.length} GPU: {advice.interconnect}</strong>
            <p>{advice.recommendation}</p>
          </div>
        ) : null}

        {resultA && first ? (
          <>
            <div className="summary" aria-live="polite">
              <div className="summary-main">
                <strong>{fits.length}</strong>
                <span>из {resultA.length} моделей помещаются</span>
              </div>
              <div className="summary-chips">
                <span className="badge badge--ok">{fullCount} full</span>
                <span className="badge badge--tight">{tightCount} tight</span>
                <span className="badge badge--ram">{ramCount} offload</span>
                <span className="badge badge--bad">{noFit.length} no fit</span>
              </div>
              <dl className="summary-specs">
                <div><dt>Бюджет VRAM</dt><dd>{gb(first.full.vramTotalGb)}</dd></div>
                <div><dt>Физически</dt><dd>{gb(first.full.vramPhysicalGb)}</dd></div>
                <div><dt>util_target</dt><dd>{num(first.full.utilTarget, 2)}</dd></div>
                <div><dt>Интерконнект</dt><dd>{first.full.interconnect}</dd></div>
              </dl>
            </div>

            {platform ? (
              <div className="selected-platform">
                <PlatformPanel platform={platform} />
              </div>
            ) : null}

            {fits.length === 0 ? (
              <div className="empty-state" role="status">
                <h3>{ru.states.noResults}</h3>
                <p>Попробуйте один из вариантов — параметры пересчитаются автоматически.</p>
                <div className="empty-actions">
                  <button type="button" className="button" onClick={() => nudgeA('lowerQuant')}>
                    {ru.actions.lowerQuant}
                  </button>
                  <button type="button" className="button" onClick={() => nudgeA('lessContext')}>
                    {ru.actions.lessContext}
                  </button>
                  <button type="button" className="button" onClick={() => nudgeA('moreGpu')}>
                    {ru.actions.addGpu}
                  </button>
                </div>
              </div>
            ) : (
              <div className="cards">
                {fits.map((evaluation) => (
                  <ModelCard
                    key={`${evaluation.model.id}-${evaluation.quant.id}`}
                    evaluation={evaluation}
                    selected={selectedModelId === evaluation.model.id}
                    onSelect={setSelectedModel}
                  />
                ))}
              </div>
            )}

            {noFit.length > 0 ? (
              <details className="no-fit">
                <summary>Не помещаются: {noFit.length}</summary>
                <div className="no-fit-list">
                  {noFit.map((evaluation) => (
                    <NoFitRow key={evaluation.model.id} evaluation={evaluation} />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <div className="empty-state empty-state--intro" role="status">
            <h3>Пока ничего не рассчитано</h3>
            <p>{ru.states.emptyA}</p>
            <p className="muted">
              Будут проверены все модели каталога: dense и MoE, включая offload через llama.cpp.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function NoFitRow({ evaluation }: { evaluation: ModelEvaluation }) {
  const reason =
    evaluation.reason === 'OFFLOAD_TOO_LARGE'
      ? 'нужно выгрузить больше 50% весов'
      : evaluation.reason === 'KV_POOL_EXHAUSTED'
        ? 'нет места под KV-кеш'
        : evaluation.reason === 'DSPARK_DRAFT_DOES_NOT_FIT'
          ? 'DSpark draft-модель не помещается'
          : evaluation.reason === 'PER_GPU_OVERFLOW'
          ? 'переполнение на одну GPU'
          : evaluation.reason === 'OFFLOAD_UNSUPPORTED'
            ? 'движок без offload'
            : 'KV-кеш не помещается';
  return (
    <div className="no-fit-row">
      <div>
        <strong>{evaluation.model.name}</strong>
        <span>
          {num(evaluation.model.params_total_b, 1)}B · {evaluation.quant.name}
        </span>
      </div>
      <div className="no-fit-metrics">
        <span>веса {gb(evaluation.full.weightsGb)}</span>
        <span>KV {gb(evaluation.full.kvRequiredGb)}</span>
        <span>{reason}</span>
      </div>
    </div>
  );
}
