import type { Catalog, Engine, Gpu, Model, Profile, Quantization, SpeedEstimate } from '../data/types';
import {
  MAX_OFFLOAD_RATIO,
  computeFullMemory,
  computeOffloadMemory,
  dsparkWarning,
  effectiveContext,
  estimateSpeed,
  findDraftModel,
  round,
  sum,
  totalPhysicalVramGb,
  type FullMemoryResult,
  type OffloadResult,
} from './core';
import { evaluateModel, multiGpuAdvice } from './fit';
import { recommendPlatform, type PlatformRecommendation } from './platform';

export type ConfigKind = 'MIN' | 'OPTIMAL' | 'MAX';

export interface HardwareConfig {
  kind: ConfigKind;
  gpu: Gpu;
  gpuCount: number;
  gpus: Gpu[];
  engine: Engine;
  physicalVramGb: number;
  allocatedVramGb: number;
  weightsInVramGb: number;
  weightsOffloadedGb: number;
  kvGb: number;
  vramUsedGb: number;
  spareRatio: number;
  offloadRatio: number;
  maxParallel: number;
  speed: SpeedEstimate;
  platform: PlatformRecommendation;
  priceUsd: number | null;
  interconnect: string;
  warnings: string[];
  draftWeightsGb: number;
  dsparkSpeedup: number;
  dsparkRequested: boolean;
  dsparkWarning: string | null;
}

export interface Recommendation {
  kind: 'context' | 'quant' | 'model';
  label: string;
  description: string;
  patch: { context?: number; quantId?: string; modelId?: string };
}

export interface ModeBResult {
  status: 'OK' | 'IMPOSSIBLE';
  engine: Engine;
  model: Model;
  quant: Quantization;
  contextTokens: number;
  users: number;
  targetToks: number;
  min: HardwareConfig | null;
  optimal: HardwareConfig | null;
  max: HardwareConfig | null;
  maxEqualsOptimal: boolean;
  reason: string | null;
  recommendations: Recommendation[];
}

export interface ModeBRequest {
  catalog: Catalog;
  model: Model;
  quant: Quantization;
  contextTokens: number;
  users: number;
  targetToks: number;
  profile: Profile;
  useDSpark?: boolean;
  draftModel?: Model | null;
}

interface Combo {
  gpu: Gpu;
  count: number;
  gpus: Gpu[];
}

function listCombos(catalog: Catalog): Combo[] {
  const combos: Combo[] = [];
  for (const gpu of catalog.gpus) {
    const maxCount = gpu.unified_memory ? 1 : 8;
    for (let count = 1; count <= maxCount; count += 1) {
      combos.push({ gpu, count, gpus: Array.from({ length: count }, () => gpu) });
    }
  }
  return combos;
}

function engineForQuant(catalog: Catalog, quant: Quantization): Engine {
  const id = quant.family === 'gguf' ? 'llama_cpp' : 'vllm';
  return catalog.engines.find((engine) => engine.id === id) ?? catalog.engines[0];
}



function configFromFull(
  kind: ConfigKind,
  combo: Combo,
  full: FullMemoryResult,
  engine: Engine,
  model: Model,
  quant: Quantization,
  profile: Profile,
  catalog: Catalog,
  useDSpark?: boolean,
  draftModel?: Model | null,
): HardwareConfig {
  const speed = estimateSpeed({
    gpus: combo.gpus,
    model,
    quant,
    engine,
    maxParallel: full.maxParallel,
    profile,
    useDSpark,
    draftModel,
  });
  const platform = recommendPlatform({
    gpus: combo.gpus,
    cpus: catalog.cpus,
    weightsGb: full.weightsGb,
    weightsOffloadedGb: 0,
    offloadRatio: 0,
    unifiedMemory: combo.gpu.unified_memory,
  });
  const advice = multiGpuAdvice(combo.gpus, engine);
  const warnings = [...platform.warnings];
  const dsparkNote = dsparkWarning(engine, useDSpark, draftModel);
  if (dsparkNote) warnings.push(dsparkNote);
  if (advice.warning) warnings.push(advice.warning);
  if (full.maxParallel < full.users) {
    warnings.push(`KV-пула хватает на ${full.maxParallel} из ${full.users} одновременных пользователей.`);
  }
  const gpuPrice = combo.gpu.price_usd ?? null;
  return {
    kind,
    gpu: combo.gpu,
    gpuCount: combo.count,
    gpus: combo.gpus,
    engine,
    physicalVramGb: totalPhysicalVramGb(combo.gpus),
    allocatedVramGb: full.vramTotalGb,
    weightsInVramGb: full.weightsGb,
    weightsOffloadedGb: 0,
    kvGb: full.kvRequiredGb,
    vramUsedGb: full.weightsGb + full.kvRequiredGb + full.overheadGb + full.workspaceGb,
    spareRatio: full.spareRatio,
    offloadRatio: 0,
    maxParallel: full.maxParallel,
    speed,
    platform,
    priceUsd: gpuPrice === null ? null : gpuPrice * combo.count + platform.extraPriceUsd,
    interconnect: advice.interconnect,
    warnings,
    draftWeightsGb: full.draftWeightsGb,
    dsparkSpeedup: speed.dsparkSpeedup,
    dsparkRequested: Boolean(useDSpark),
    dsparkWarning: dsparkNote,
  };
}

function configFromOffload(
  kind: ConfigKind,
  combo: Combo,
  offload: OffloadResult,
  full: FullMemoryResult,
  engine: Engine,
  model: Model,
  quant: Quantization,
  profile: Profile,
  catalog: Catalog,
  useDSpark?: boolean,
  draftModel?: Model | null,
): HardwareConfig {
  const speed = estimateSpeed({
    gpus: combo.gpus,
    model,
    quant,
    engine,
    maxParallel: offload.maxParallel,
    profile,
    offloadRatio: offload.offloadRatio,
    useDSpark,
    draftModel,
  });
  const platform = recommendPlatform({
    gpus: combo.gpus,
    cpus: catalog.cpus,
    weightsGb: full.weightsGb,
    weightsOffloadedGb: offload.weightsOffloadedGb,
    offloadRatio: offload.offloadRatio,
    unifiedMemory: combo.gpu.unified_memory,
  });
  const advice = multiGpuAdvice(combo.gpus, engine);
  const warnings = [...platform.warnings];
  const dsparkNote = dsparkWarning(engine, useDSpark, draftModel);
  if (dsparkNote) warnings.push(dsparkNote);
  if (advice.warning) warnings.push(advice.warning);
  if (offload.maxParallel < full.users) {
    warnings.push(`KV-пула хватает на ${offload.maxParallel} из ${full.users} одновременных пользователей.`);
  }
  const gpuPrice = combo.gpu.price_usd ?? null;
  return {
    kind,
    gpu: combo.gpu,
    gpuCount: combo.count,
    gpus: combo.gpus,
    engine,
    physicalVramGb: totalPhysicalVramGb(combo.gpus),
    allocatedVramGb: full.vramTotalGb,
    weightsInVramGb: offload.weightsOnGpuGb,
    weightsOffloadedGb: offload.weightsOffloadedGb,
    kvGb: offload.kvRequiredGb,
    vramUsedGb: offload.vramUsedGb,
    spareRatio: full.vramTotalGb > 0 ? offload.kvPoolGb / full.vramTotalGb : 0,
    offloadRatio: offload.offloadRatio,
    maxParallel: offload.maxParallel,
    speed,
    platform,
    priceUsd: gpuPrice === null ? null : gpuPrice * combo.count + platform.extraPriceUsd,
    interconnect: advice.interconnect,
    warnings,
    draftWeightsGb: offload.draftWeightsGb,
    dsparkSpeedup: speed.dsparkSpeedup,
    dsparkRequested: Boolean(useDSpark),
    dsparkWarning: dsparkNote,
  };
}

function priceOf(config: HardwareConfig): number {
  return config.priceUsd ?? Number.POSITIVE_INFINITY;
}

function pickMinConfigs(
  req: ModeBRequest,
  engine: Engine,
  combos: Combo[],
): HardwareConfig[] {
  const { catalog, model, quant, contextTokens, users, targetToks, profile, useDSpark, draftModel } = req;
  const candidates: HardwareConfig[] = [];
  for (const combo of combos) {
    const full = computeFullMemory({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      contextTokens,
      users,
      useDSpark,
      draftModel,
    });
    const fullSpeedEstimate = estimateSpeed({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      maxParallel: full.maxParallel,
      profile,
      useDSpark,
      draftModel,
    });
    const fullOk =
      full.fitPerGpu &&
      full.kvPoolGb > 0 &&
      full.maxParallel >= users &&
      fullSpeedEstimate.tokPerSeq >= targetToks * 0.5;

    if (fullOk) {
      candidates.push(configFromFull('MIN', combo, full, engine, model, quant, profile, catalog, useDSpark, draftModel));
      continue;
    }

    const offload = computeOffloadMemory({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      contextTokens,
      users,
      useDSpark,
      draftModel,
    });
    if (!offload || !offload.feasible || offload.offloadRatio > 0.4) continue;
    const offloadSpeed = estimateSpeed({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      maxParallel: offload.maxParallel,
      profile,
      offloadRatio: offload.offloadRatio,
      useDSpark,
      draftModel,
    });
    if (offload.maxParallel < users || offloadSpeed.tokPerSeq < targetToks * 0.5) continue;
    candidates.push(configFromOffload('MIN', combo, offload, full, engine, model, quant, profile, catalog, useDSpark, draftModel));
  }

  candidates.sort(
    (a, b) =>
      a.physicalVramGb - b.physicalVramGb ||
      a.offloadRatio - b.offloadRatio ||
      priceOf(a) - priceOf(b) ||
      a.gpuCount - b.gpuCount,
  );
  return candidates;
}

function pickOptimalConfig(
  req: ModeBRequest,
  engine: Engine,
  combos: Combo[],
  minVram: number,
): HardwareConfig | null {
  const { catalog, model, quant, contextTokens, users, targetToks, profile, useDSpark, draftModel } = req;
  const candidates: HardwareConfig[] = [];
  for (const combo of combos) {
    if (totalPhysicalVramGb(combo.gpus) < minVram) continue;
    const full = computeFullMemory({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      contextTokens,
      users,
      utilTarget: 0.9,
      useDSpark,
      draftModel,
    });
    if (!full.fitPerGpu || full.kvPoolGb <= 0) continue;
    if (full.maxParallel < users) continue;
    if (full.spareRatio < 0.15) continue;
    const speed = estimateSpeed({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      maxParallel: full.maxParallel,
      profile,
      useDSpark,
      draftModel,
    });
    if (speed.tokPerSeq < targetToks) continue;
    candidates.push(configFromFull('OPTIMAL', combo, full, engine, model, quant, profile, catalog, useDSpark, draftModel));
  }

  candidates.sort(
    (a, b) =>
      Number(a.spareRatio > 0.3) - Number(b.spareRatio > 0.3) ||
      priceOf(a) - priceOf(b) ||
      a.physicalVramGb - b.physicalVramGb ||
      b.spareRatio - a.spareRatio,
  );
  return candidates[0] ?? null;
}

function pickMaxConfig(
  req: ModeBRequest,
  engine: Engine,
  combos: Combo[],
  optimal: HardwareConfig,
): HardwareConfig | null {
  const { catalog, model, quant, users, targetToks, profile, useDSpark, draftModel } = req;
  const targetVram = optimal.physicalVramGb * 1.5;
  const targetParallel = Math.max(users * 2, optimal.maxParallel * 2);
  const scored: HardwareConfig[] = [];

  for (const combo of combos) {
    const physical = totalPhysicalVramGb(combo.gpus);
    if (physical < optimal.physicalVramGb) continue;
    const full = computeFullMemory({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      contextTokens: req.contextTokens,
      users,
      utilTarget: 0.9,
      useDSpark,
      draftModel,
    });
    if (!full.fitPerGpu || full.kvPoolGb <= 0) continue;
    if (full.spareRatio < 0.4) continue;
    if (full.maxParallel < targetParallel) continue;
    const speed = estimateSpeed({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      maxParallel: full.maxParallel,
      profile,
      useDSpark,
      draftModel,
    });
    if (speed.tokPerSeq < targetToks) continue;
    scored.push(configFromFull('MAX', combo, full, engine, model, quant, profile, catalog, useDSpark, draftModel));
  }

  const preferred = scored
    .filter((config) => config.physicalVramGb >= targetVram)
    .sort((a, b) => a.physicalVramGb - b.physicalVramGb || priceOf(a) - priceOf(b));
  if (preferred.length > 0) return preferred[0];

  const fallback = scored.sort((a, b) => b.physicalVramGb - a.physicalVramGb || priceOf(a) - priceOf(b));
  if (fallback.length > 0) {
    const config = fallback[0];
    config.warnings.push('Каталог не позволяет увеличить VRAM в 1.5× — выбрана максимальная доступная конфигурация.');
    return config;
  }

  // Ни одна конфигурация не проходит формальные критерии MAX — берём максимальную по VRAM.
  const all: HardwareConfig[] = [];
  for (const combo of combos) {
    if (totalPhysicalVramGb(combo.gpus) < optimal.physicalVramGb) continue;
    const full = computeFullMemory({
      gpus: combo.gpus,
      model,
      quant,
      engine,
      contextTokens: req.contextTokens,
      users,
      utilTarget: 0.9,
      useDSpark,
      draftModel,
    });
    if (!full.fitPerGpu || full.kvPoolGb <= 0) continue;
    all.push(configFromFull('MAX', combo, full, engine, model, quant, profile, catalog, useDSpark, draftModel));
  }
  const largest = all.sort((a, b) => b.physicalVramGb - a.physicalVramGb || priceOf(a) - priceOf(b))[0];
  if (!largest) return null;
  largest.warnings.push('MAX не удалось подобрать по строгим критериям; показана крупнейшая совместимая конфигурация.');
  return largest;
}

function raiseCpuCores(config: HardwareConfig, minCores: number, catalog: Catalog): HardwareConfig {
  if (config.platform.cpu.cores >= minCores) return config;
  const candidate = catalog.cpus
    .filter((cpu) => cpu.cores >= minCores && cpu.pcie_lanes >= config.platform.requiredPcieLanes)
    .sort((a, b) => a.price_usd - b.price_usd || b.cores - a.cores)[0];
  if (!candidate) return config;
  return {
    ...config,
    platform: {
      ...config.platform,
      cpu: candidate,
      psuW: Math.max(config.platform.psuW, Math.ceil((sum(config.gpus.map((gpu) => gpu.tdp_w)) + candidate.tdp_w + 150) * 1.3)),
    },
  };
}

/** Инвариант MIN ≤ OPTIMAL ≤ MAX. RAM/CPU/PSU при offload-MIN могут быть выше, поэтому выравниваем вверх. */
function enforceMonotonic(min: HardwareConfig | null, optimal: HardwareConfig | null, max: HardwareConfig | null, catalog: Catalog): {
  optimal: HardwareConfig | null;
  max: HardwareConfig | null;
} {
  let opt = optimal;
  if (opt && min) {
    const ramGb = Math.max(opt.platform.ramGb, min.platform.ramGb);
    const psuW = Math.max(opt.platform.psuW, min.platform.psuW);
    opt = {
      ...opt,
      platform: { ...opt.platform, ramGb, psuW },
    };
    opt = raiseCpuCores(opt, min.platform.cpu.cores, catalog);
  }
  let mx = max;
  if (mx && opt) {
    mx = {
      ...mx,
      platform: {
        ...mx.platform,
        ramGb: Math.max(mx.platform.ramGb, opt.platform.ramGb),
        psuW: Math.max(mx.platform.psuW, opt.platform.psuW),
      },
    };
    mx = raiseCpuCores(mx, opt.platform.cpu.cores, catalog);
  }
  return { optimal: opt, max: mx };
}

function smallerModelRecommendations(req: ModeBRequest, combos: Combo[]): Recommendation[] {
  const { catalog, model, quant, contextTokens, users, profile } = req;
  const out: Recommendation[] = [];
  const biggest = [...catalog.gpus]
    .filter((gpu) => !gpu.unified_memory)
    .sort((a, b) => b.vram_gb - a.vram_gb)[0];
  const bestGpus = biggest ? Array.from({ length: 8 }, () => biggest) : (combos[combos.length - 1]?.gpus ?? []);
  const smaller = catalog.models
    .filter(
      (candidate) =>
        candidate.status === 'released' &&
        !candidate.is_draft &&
        candidate.id !== model.id &&
        candidate.params_total_b < model.params_total_b,
    )
    .sort((a, b) => b.params_total_b - a.params_total_b);

  for (const candidate of smaller) {
    if (candidate.max_context < contextTokens) continue;
    const candidateEngine = engineForQuant(catalog, quant);
    const feasible = evaluateModel({
      gpus: bestGpus,
      model: candidate,
      quant,
      engine: candidateEngine,
      contextTokens,
      users,
      profile,
      utilTarget: 0.9,
      useDSpark: req.useDSpark,
      draftModel: req.useDSpark ? findDraftModel(catalog.models, candidate.id) : null,
    });
    if (feasible.status !== 'NO_FIT') {
      out.push({
        kind: 'model',
        label: candidate.name,
        description: `${candidate.params_total_b}B, ${candidate.max_context.toLocaleString('ru-RU')} токенов контекста.`,
        patch: { modelId: candidate.id },
      });
      if (out.length >= 3) break;
    }
  }
  return out;
}

export function buildConfigurations(req: ModeBRequest): ModeBResult {
  const { catalog, model, quant, users, targetToks } = req;
  const engine = engineForQuant(catalog, quant);
  const contextTokens = effectiveContext(model, req.contextTokens);
  const draftModel = req.useDSpark ? findDraftModel(catalog.models, model.id) : null;
  const effectiveReq: ModeBRequest = { ...req, contextTokens, draftModel };
  const combos = listCombos(catalog);

  const minCandidates = pickMinConfigs(effectiveReq, engine, combos);
  const min = minCandidates[0] ?? null;

  const optimal = pickOptimalConfig(effectiveReq, engine, combos, min?.physicalVramGb ?? 0);
  if (!optimal) {
    const recommendations: Recommendation[] = [];
    if (contextTokens > 512) {
      recommendations.push({
        kind: 'context',
        label: `Уменьшить контекст до ${Math.max(512, Math.floor(contextTokens / 2)).toLocaleString('ru-RU')}`,
        description: 'KV-кеш растёт линейно по контексту и числу пользователей.',
        patch: { context: Math.max(512, Math.floor(contextTokens / 2)) },
      });
    }
    if (quant.bytes_per_param > 0.43) {
      const cheaper = catalog.quantizations
        .filter((candidate) => candidate.family === quant.family && candidate.bytes_per_param < quant.bytes_per_param)
        .sort((a, b) => b.bytes_per_param - a.bytes_per_param)[0];
      if (cheaper) {
        recommendations.push({
          kind: 'quant',
          label: `Снизить квантизацию до ${cheaper.name}`,
          description: 'Меньше байт на параметр — меньше весов в VRAM.',
          patch: { quantId: cheaper.id },
        });
      }
    }
    recommendations.push(...smallerModelRecommendations(effectiveReq, combos));

    return {
      status: 'IMPOSSIBLE',
      engine,
      model,
      quant,
      contextTokens,
      users,
      targetToks,
      min,
      optimal: null,
      max: null,
      maxEqualsOptimal: false,
      reason: `Модель не помещается полностью в VRAM при ${users} пользователях, контексте ${contextTokens.toLocaleString('ru-RU')} и квантизации ${quant.name}.`,
      recommendations,
    };
  }

  const rawMax = pickMaxConfig(effectiveReq, engine, combos, optimal);
  const normalized = enforceMonotonic(min, optimal, rawMax, catalog);
  const finalOptimal = normalized.optimal as HardwareConfig;
  const finalMax = normalized.max;
  const maxEqualsOptimal =
    !finalMax ||
    (finalMax.gpu.id === finalOptimal.gpu.id && finalMax.gpuCount === finalOptimal.gpuCount);

  if (min?.offloadRatio && min.offloadRatio > 0) {
    min.warnings.push(
      `MIN: ${round(min.offloadRatio * 100, 0)}% весов в RAM, ожидаемое падение скорости ~${round(1 / Math.max(min.speed.offloadPenalty, 0.01), 1)}×.`,
    );
  }

  return {
    status: 'OK',
    engine,
    model,
    quant,
    contextTokens,
    users,
    targetToks,
    min,
    optimal: finalOptimal,
    max: maxEqualsOptimal ? null : finalMax,
    maxEqualsOptimal,
    reason: null,
    recommendations: [],
  };
}

export const CONFIG_LIMITS = { MAX_OFFLOAD_RATIO } as const;
