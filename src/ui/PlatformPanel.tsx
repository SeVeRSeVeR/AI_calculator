import type { PlatformRecommendation } from '../calc/platform';
import { gb, num, nvme } from './format';

export function PlatformPanel({
  platform,
  compact = false,
}: {
  platform: PlatformRecommendation;
  compact?: boolean;
}) {
  return (
    <section className={compact ? 'platform platform--compact' : 'platform'} aria-label="Рекомендуемая платформа">
      <h3>Рекомендуемая платформа</h3>
      <dl className="platform-grid">
        <div>
          <dt>CPU</dt>
          <dd>
            <strong>{platform.cpu.name}</strong>
            <span>{platform.cpu.cores} ядер · {platform.cpu.pcie_lanes} линий PCIe · {platform.cpu.tdp_w} Вт</span>
          </dd>
        </div>
        <div>
          <dt>RAM</dt>
          <dd>
            <strong>{gb(platform.ramGb)}</strong>
            <span>{platform.ramNote}</span>
          </dd>
        </div>
        <div>
          <dt>NVMe</dt>
          <dd>
            <strong>{nvme(platform.nvmeGb)}</strong>
            <span>{platform.nvmeNote}</span>
          </dd>
        </div>
        <div>
          <dt>PSU</dt>
          <dd>
            <strong>{num(platform.psuW, 0)} Вт</strong>
            <span>{platform.psuNote}</span>
          </dd>
        </div>
        <div>
          <dt>Охлаждение</dt>
          <dd>
            <strong>{platform.cooling}</strong>
            <span>{platform.coolingNote}</span>
          </dd>
        </div>
        <div>
          <dt>PCIe / ядра</dt>
          <dd>
            <strong>{platform.requiredPcieLanes} линий · минимум {platform.coresMin} ядер</strong>
            <span>{platform.cpuNote}</span>
          </dd>
        </div>
      </dl>
      {platform.warnings.length > 0 ? (
        <ul className="warnings" aria-label="Предупреждения по платформе">
          {platform.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
