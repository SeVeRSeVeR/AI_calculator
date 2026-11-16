import type { HardwareConfig } from '../calc/configs';
import { gb, money, num, pct, tps } from './format';
import { PlatformPanel } from './PlatformPanel';

const TITLES: Record<HardwareConfig['kind'], string> = {
  MIN: 'Минимальная',
  OPTIMAL: 'Оптимальная',
  MAX: 'Максимальная',
};

const SUBTITLES: Record<HardwareConfig['kind'], string> = {
  MIN: 'Наименьшая суммарная VRAM; допускается offload до 40% весов.',
  OPTIMAL: '100% весов и полный KV-пул в VRAM, запас 15–30%, все пользователи обслуживаются.',
  MAX: 'Запас на рост: ×1.5 VRAM и ×2 к параллелизму относительно оптимальной.',
};

export function ConfigCard({ config, collapsed }: { config: HardwareConfig; collapsed?: boolean }) {
  const total = Math.max(0.001, config.allocatedVramGb);
  const reserved = Math.max(0, config.vramUsedGb - config.weightsInVramGb - config.kvGb);
  const weightsPct = Math.min(100, (config.weightsInVramGb / total) * 100);
  const kvPct = Math.min(100 - weightsPct, (config.kvGb / total) * 100);
  const reservedPct = Math.min(100 - weightsPct - kvPct, (reserved / total) * 100);
  const freePct = Math.max(0, 100 - weightsPct - kvPct - reservedPct);

  return (
    <article className={`config-card config-card--${config.kind.toLowerCase()}`}>
      <header className="config-head">
        <div>
          <span className="eyebrow">{config.kind}</span>
          <h3>{collapsed ? 'Оптимальная — MAX не требуется' : TITLES[config.kind]}</h3>
          <p>{collapsed ? 'Оптимальная конфигурация уже покрывает двукратный рост нагрузки.' : SUBTITLES[config.kind]}</p>
        </div>
        <div className="config-price">{money(config.priceUsd)}</div>
      </header>

      <div className="config-gpu">
        <strong>{config.gpuCount} × {config.gpu.name}</strong>
        <span>
          {gb(config.physicalVramGb)} физически · {gb(config.allocatedVramGb)} доступно · {gb(config.vramUsedGb)} занято ·{' '}
          {config.gpu.class === 'datacenter' ? 'datacenter' : config.gpu.class === 'prosumer' ? 'prosumer' : 'consumer'} ·{' '}
          {config.interconnect}
        </span>
      </div>

      <div
        className="vram-bar"
        role="img"
        aria-label={`VRAM: веса ${gb(config.weightsInVramGb)}, KV ${gb(config.kvGb)}, резерв ${gb(reserved)}, свободно ${gb((freePct / 100) * total)}`}
      >
        <span className="bar-weights" style={{ width: `${weightsPct}%` }} title={`Веса: ${gb(config.weightsInVramGb)}`} />
        <span className="bar-kv" style={{ width: `${kvPct}%` }} title={`KV: ${gb(config.kvGb)}`} />
        <span className="bar-reserved" style={{ width: `${reservedPct}%` }} title={`Резерв: ${gb(reserved)}`} />
        <span className="bar-free" style={{ width: `${freePct}%` }} />
      </div>

      <dl className="metrics">
        <div>
          <dt>Веса в VRAM</dt>
          <dd>{gb(config.weightsInVramGb)}</dd>
        </div>
        <div>
          <dt>KV-кеш</dt>
          <dd>{gb(config.kvGb)}</dd>
        </div>
        <div>
          <dt>В RAM</dt>
          <dd>{config.weightsOffloadedGb > 0 ? `${gb(config.weightsOffloadedGb)} (${pct(config.offloadRatio)})` : '—'}</dd>
        </div>
        <div>
          <dt>Запас VRAM</dt>
          <dd>{pct(Math.max(0, config.spareRatio))}</dd>
        </div>
        <div>
          <dt>Max parallel</dt>
          <dd>{config.maxParallel}</dd>
        </div>
        <div>
          <dt>Скорость / seq</dt>
          <dd>{tps(config.speed.tokPerSeqMin)}–{tps(config.speed.tokPerSeqMax)} tok/s</dd>
        </div>
        <div>
          <dt>Суммарно</dt>
          <dd>{tps(config.speed.totalTokS)} tok/s</dd>
        </div>
        <div>
          <dt>Батч-эффективность</dt>
          <dd>{num(config.speed.batchEfficiency * 100, 0)}%</dd>
        </div>
      </dl>

      {config.dsparkRequested ? (
        config.dsparkSpeedup > 1 ? (
          <p className="model-dspark">
            DSpark: +{num((config.dsparkSpeedup - 1) * 100, 0)}% к скорости (draft-модель{' '}
            {gb(config.draftWeightsGb)})
          </p>
        ) : (
          <p className="model-warning">{config.dsparkWarning ?? 'DSpark не применён.'}</p>
        )
      ) : null}

      {config.offloadRatio > 0 ? (
        <p className="model-warning">
          {pct(config.offloadRatio)} весов в RAM, ожидаемое падение скорости ~
          {num(1 / Math.max(config.speed.offloadPenalty, 0.01), 1)}×. RAM и CPU рассчитаны с учётом offload.
        </p>
      ) : null}

      <PlatformPanel platform={config.platform} compact />

      {config.warnings.length > 0 ? (
        <ul className="warnings" aria-label="Предупреждения конфигурации">
          {config.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
