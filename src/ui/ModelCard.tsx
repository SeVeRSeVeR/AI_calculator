import type { ModelEvaluation } from '../calc/fit';
import type { FitStatus } from '../data/types';
import { gb, num, pct, tokens, tps } from './format';

const STATUS_LABEL: Record<FitStatus, string> = {
  FITS_FULL: 'Полностью в VRAM',
  FITS_TIGHT: 'Влезает без запаса',
  FITS_WITH_RAM: 'Нужен offload в RAM',
  NO_FIT: 'Не помещается',
};

const STATUS_CLASS: Record<FitStatus, string> = {
  FITS_FULL: 'ok',
  FITS_TIGHT: 'tight',
  FITS_WITH_RAM: 'ram',
  NO_FIT: 'bad',
};

function reasonText(evaluation: ModelEvaluation): string | null {
  switch (evaluation.reason) {
    case 'KV_POOL_EXHAUSTED':
      return 'Веса и служебные буферы не оставляют места под KV-кеш.';
    case 'PER_GPU_OVERFLOW':
      return 'На одну карту приходится больше памяти, чем доступно: TP не спасает из-за репликации активаций и контекста.';
    case 'OFFLOAD_TOO_LARGE':
      return 'Для размещения потребовалось бы выгрузить больше 50% весов — это уже нерабочий режим.';
    case 'OFFLOAD_UNSUPPORTED':
      return 'Движок не поддерживает offload. Используйте llama.cpp или карту с большей VRAM.';
    case 'KV_DOES_NOT_FIT':
      return 'KV-кеш для заданного контекста и числа пользователей не помещается.';
    default:
      return null;
  }
}

export function ModelCard({
  evaluation,
  selected,
  onSelect,
  sideLabel,
}: {
  evaluation: ModelEvaluation;
  selected: boolean;
  onSelect: (id: string) => void;
  sideLabel?: string;
}) {
  const { model, quant, full } = evaluation;
  const total = Math.max(0.001, full.vramTotalGb);
  const reserved = full.overheadGb + full.workspaceGb;
  const used = evaluation.weightsInVramGb + evaluation.kvGb + reserved;
  const free = Math.max(0, total - used);
  const overflow = used > total;
  const weightsPct = Math.min(100, (evaluation.weightsInVramGb / total) * 100);
  const kvPct = Math.min(100 - weightsPct, (evaluation.kvGb / total) * 100);
  const reservedPct = Math.min(100 - weightsPct - kvPct, (reserved / total) * 100);
  const freePct = Math.max(0, 100 - weightsPct - kvPct - reservedPct);
  const vramPercent = full.vramPhysicalGb > 0 ? evaluation.vramUsedGb / full.vramPhysicalGb : 0;
  const reason = reasonText(evaluation);

  return (
    <article className={`model-card status-${STATUS_CLASS[evaluation.status]}${selected ? ' selected' : ''}`}>
      <header className="model-card-head">
        <div>
          <h3>{model.name}</h3>
          <p>
            {model.vendor} · {num(model.params_total_b, 1)}B
            {model.moe ? ` MoE / ${num(model.params_active_b, 1)}B active` : ' dense'} · {quant.name}
          </p>
        </div>
        <span className={`badge badge--${STATUS_CLASS[evaluation.status]}`}>{STATUS_LABEL[evaluation.status]}</span>
      </header>

      <div
        className="vram-bar"
        role="img"
        aria-label={`Распределение VRAM: веса ${gb(evaluation.weightsInVramGb)}, KV ${gb(evaluation.kvGb)}, резерв ${gb(reserved)}, свободно ${gb(free)}${evaluation.weightsOffloadedGb > 0 ? `, в RAM ${gb(evaluation.weightsOffloadedGb)}` : ''}`}
      >
        <span className="bar-weights" style={{ width: `${weightsPct}%` }} title={`Веса: ${gb(evaluation.weightsInVramGb)}`} />
        <span className="bar-kv" style={{ width: `${kvPct}%` }} title={`KV: ${gb(evaluation.kvGb)}`} />
        <span className="bar-reserved" style={{ width: `${reservedPct}%` }} title={`Резерв: ${gb(reserved)}`} />
        <span className={overflow ? 'bar-overflow' : 'bar-free'} style={{ width: `${overflow ? 0 : freePct}%` }} />
      </div>

      <dl className="metrics">
        <div>
          <dt>Веса</dt>
          <dd>{gb(evaluation.weightsInVramGb)}</dd>
        </div>
        <div>
          <dt>KV @ {tokens(full.contextTokens)}</dt>
          <dd>{gb(evaluation.kvGb)}</dd>
        </div>
        <div>
          <dt>Всего VRAM</dt>
          <dd>{gb(evaluation.vramUsedGb)} <small>{pct(vramPercent)} от карт</small></dd>
        </div>
        <div>
          <dt>Max parallel</dt>
          <dd>{evaluation.maxParallel}</dd>
        </div>
        <div>
          <dt>Скорость / seq</dt>
          <dd>{tps(evaluation.speed.tokPerSeqMin)}–{tps(evaluation.speed.tokPerSeqMax)} tok/s</dd>
        </div>
        <div>
          <dt>Суммарно</dt>
          <dd>{tps(evaluation.speed.totalTokS)} tok/s</dd>
        </div>
      </dl>

      <p className="model-meta-line">
        {model.n_layers} слоёв · {model.n_kv_heads} KV-heads · head_dim {model.head_dim} · контекст до{' '}
        {tokens(model.max_context)} · {model.license}
      </p>

      {evaluation.weightsOffloadedGb > 0 ? (
        <p className="model-warning">
          {pct(evaluation.offloadRatio)} весов ({gb(evaluation.weightsOffloadedGb)}) в RAM. Ожидаемое падение
          скорости ~{num(1 / Math.max(evaluation.speed.offloadPenalty, 0.01), 1)}×.
        </p>
      ) : null}
      {evaluation.status === 'FITS_TIGHT' ? (
        <p className="model-warning">
          Запас VRAM {pct(Math.max(0, evaluation.spareRatio))} — меньше 15%. Рост контекста или пользователей
          приведёт к OOM.
        </p>
      ) : null}
      {!evaluation.servesRequestedUsers && evaluation.status !== 'NO_FIT' ? (
        <p className="model-warning">
          KV-пула хватает на {evaluation.maxParallel} из {full.users} одновременных пользователей.
        </p>
      ) : null}
      {evaluation.status === 'NO_FIT' && reason ? <p className="model-warning">{reason}</p> : null}

      <div className="card-actions">
        {evaluation.status === 'NO_FIT' ? (
          <span className="muted">{sideLabel ?? 'Не участвует в подборе платформы'}</span>
        ) : (
          <button
            type="button"
            className="button button--ghost"
            aria-pressed={selected}
            onClick={() => onSelect(model.id)}
          >
            {selected ? 'Платформа показана' : 'Выбрать платформу'}
          </button>
        )}
      </div>
    </article>
  );
}
