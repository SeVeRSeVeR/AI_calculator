import type { Cpu, Gpu } from '../data/types';
import { psuWatts, roundUpTo, sum } from './core';

const RAM_MODULES = [8, 16, 32, 64, 128, 256, 512];
const PSU_MODULES = [650, 850, 1000, 1200, 1600, 2000];
const NVME_MODULES = [1024, 2048, 4096, 8192, 16384, 32768];

export interface PlatformInput {
  gpus: Gpu[];
  cpus: Cpu[];
  weightsGb: number;
  weightsOffloadedGb: number;
  kvOffloadedGb?: number;
  offloadRatio: number;
  unifiedMemory?: boolean;
  modelsExpected?: number;
}

export interface PlatformRecommendation {
  cpu: Cpu;
  cpuNote: string;
  requiredPcieLanes: number;
  coresMin: number;
  ramGb: number;
  ramNote: string;
  nvmeGb: number;
  nvmeNote: string;
  psuW: number;
  psuNote: string;
  cooling: string;
  coolingNote: string;
  warnings: string[];
  extraPriceUsd: number;
}

function pickCpu(cpus: Cpu[], requiredLanes: number, coresMin: number): { cpu: Cpu; exact: boolean } {
  const exact = cpus
    .filter((cpu) => cpu.pcie_lanes >= requiredLanes && cpu.cores >= coresMin)
    .sort((a, b) => a.price_usd - b.price_usd || a.tdp_w - b.tdp_w || b.cores - a.cores);
  if (exact.length > 0) return { cpu: exact[0], exact: true };
  const fallback = [...cpus].sort(
    (a, b) => b.pcie_lanes - a.pcie_lanes || b.cores - a.cores || a.price_usd - b.price_usd,
  );
  return { cpu: fallback[0], exact: false };
}

export function recommendPlatform(input: PlatformInput): PlatformRecommendation {
  const { gpus, cpus, weightsGb, weightsOffloadedGb, offloadRatio } = input;
  const gpuCount = gpus.length;
  const warnings: string[] = [];
  const totalGpuTdp = sum(gpus.map((gpu) => gpu.tdp_w));
  const datacenter = gpus.some((gpu) => gpu.class === 'datacenter');
  const unified = input.unifiedMemory ?? gpus.some((gpu) => gpu.unified_memory);

  // §4.12
  const requiredLanes = unified ? 0 : (datacenter ? 8 : 16) * gpuCount;
  const coresMin = Math.max(8, 2 * gpuCount) + (offloadRatio > 0 ? 4 : 0);
  const { cpu, exact } = pickCpu(cpus, requiredLanes, coresMin);
  if (!exact) {
    warnings.push(
      `В каталоге нет CPU, одновременно покрывающего ${requiredLanes} линий PCIe и ${coresMin} ядер. Выбран максимальный по линиям.`,
    );
  }

  const cpuNote = offloadRatio > 0
    ? 'При offload CPU участвует в prefill, токенизации и пересылке слоёв, поэтому требования повышены.'
    : 'CPU не влияет на скорость decode при полном размещении в VRAM; он важен для prefill, токенизации и при offload.';

  // §4.11
  const kvOffloaded = input.kvOffloadedGb ?? 0;
  const ramRaw = offloadRatio > 0
    ? Math.max(weightsOffloadedGb + kvOffloaded + 4 + 2, 1.3 * weightsOffloadedGb)
    : 16;
  const ramGb = roundUpTo(Math.max(16, ramRaw), RAM_MODULES);
  if (ramRaw > 512) warnings.push('Расчётная RAM превышает 512 ГБ — потребуется серверная платформа с большим числом каналов.');
  const ramNote = offloadRatio > 0
    ? `В RAM выгружается ${weightsOffloadedGb.toFixed(1)} ГБ весов. Минимум: выгруженные веса + 6 ГБ на ОС и page cache, с коэффициентом 1.3.`
    : `При полном размещении в VRAM достаточно ${ramGb} ГБ: память нужна ОС, драйверам и page cache, но не для весов модели.`;
  if (unified) warnings.push('Unified memory: GPU и CPU используют общий пул — отдельная планка RAM не суммируется с VRAM.');

  // §4.14
  const modelsExpected = input.modelsExpected ?? 5;
  const nvmeRaw = Math.max(1024, weightsGb * modelsExpected * 1.2);
  const nvmeGb = roundUpTo(nvmeRaw, NVME_MODULES);
  if (nvmeRaw > 32768) warnings.push('Для хранения 5 копий модели нужно больше 32 ТБ NVMe — используйте сетевой сторедж.');
  const nvmeNote = `Веса ${weightsGb.toFixed(1)} ГБ × ${modelsExpected} моделей × 1.2 (запас на кванты и чекпойнты), но не менее 1 ТБ.`;

  // §4.13
  const psuRaw = psuWatts(totalGpuTdp, cpu.tdp_w);
  const psuW = roundUpTo(psuRaw, PSU_MODULES);
  if (psuRaw > 2000) warnings.push('Расчётная мощность > 2000 Вт: нужен серверный БП или несколько БП с балансировкой.');
  const psuNote = `(${totalGpuTdp.toFixed(0)} Вт GPU + ${cpu.tdp_w.toFixed(0)} Вт CPU + 150 Вт) × 1.3, округлено до стандартного номинала.`;

  // Охлаждение
  const cooling = totalGpuTdp >= 1200
    ? 'СЖО / серверное жидкостное охлаждение'
    : totalGpuTdp >= 600
      ? 'СЖО 360 мм или серверные турбины'
      : 'Воздушное охлаждение';
  const coolingNote = datacenter
    ? 'SXM/OAM-карты рассчитаны на серверный шасси с высоконапорными вентиляторами; в потребительский корпус не ставятся.'
    : `Суммарный TDP GPU ${totalGpuTdp.toFixed(0)} Вт. Учитывайте thermal throttling и продув корпуса; расчёт этого не моделирует.`;

  const extraPriceUsd = cpu.price_usd;

  return {
    cpu,
    cpuNote,
    requiredPcieLanes: requiredLanes,
    coresMin,
    ramGb,
    ramNote,
    nvmeGb,
    nvmeNote,
    psuW,
    psuNote,
    cooling,
    coolingNote,
    warnings,
    extraPriceUsd,
  };
}
