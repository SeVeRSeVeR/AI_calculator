import type { Engine, Gpu, Interconnect, Model, Profile, Quantization, SpeedEstimate } from '../data/types';

/**
 * Вычислительное ядро. Все функции чистые: никакого DOM, fetch и глобального состояния.
 * Версия формул: calc v1.0 (см. ASSUMPTIONS.md).
 */

export const CALC_VERSION = '1.0';
export const WEIGHTS_MULTIPLIER = 1.05; // 5% на эмбеддинги, нормы, метаданные
export const CUDA_CONTEXT_GB = 1.5; // на каждую GPU, а не 0.6
export const WORKSPACE_RATIO = 0.05; // фрагментация + активации
export const NCCL_PCIE_GB = 0.5;
export const NCCL_NVLINK_GB = 0.75;
export const OFFLOAD_SPEED_ALPHA = 2.5;
export const MAX_OFFLOAD_RATIO = 0.5;

// DSpark: спекулятивное декодирование с отдельной draft-моделью (EAGLE-style).
// ASSUMPTION: консервативные коэффициенты 1.3× для llama.cpp и 1.5× для vLLM/SGLang;
// в открытых бенчмарках встречается до 1.85×. См. ASSUMPTIONS.md.
export const DSPARK_WEIGHTS_MULTIPLIER = 1.05;
export const DSPARK_SPEEDUP_LLAMA_CPP = 1.3;
export const DSPARK_SPEEDUP_DEFAULT = 1.5;

// ASSUMPTION: профили нагрузки влияют на целевой tok/s и на эффективность батчинга.
export const PROFILE_SETTINGS: Record<Profile, { targetToks: number; batchMultiplier: number; label: string }> = {
  chat: { targetToks: 15, batchMultiplier: 1.0, label: 'Чат' },
  rag: { targetToks: 25, batchMultiplier: 0.95, label: 'RAG / длинный контекст' },
  code: { targetToks: 20, batchMultiplier: 0.9, label: 'Код / агенты' },
  batch: { targetToks: 40, batchMultiplier: 1.05, label: 'Пакетная обработка' },
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const sum = (values: number[]): number => values.reduce((acc, value) => acc + value, 0);

export function effectiveContext(model: Model, requested: number): number {
  return Math.max(1, Math.min(Math.floor(requested), model.max_context));
}

export function totalPhysicalVramGb(gpus: Gpu[]): number {
  return sum(gpus.map((gpu) => gpu.vram_gb));
}

export function minGpuVramGb(gpus: Gpu[]): number {
  return gpus.length === 0 ? 0 : Math.min(...gpus.map((gpu) => gpu.vram_gb));
}

export function utilTargetFor(engine: Engine, override?: number): number {
  return clamp(override ?? engine.default_util_target, 0.5, 1);
}

/** §4.2. Для MoE всегда params_total_b. */
export function weightsGb(model: Model, quant: Quantization): number {
  return model.params_total_b * quant.bytes_per_param * WEIGHTS_MULTIPLIER;
}

/** DSpark draft-модель для целевой модели (по dspark_target_models). */
export function findDraftModel(models: Model[], targetModelId: string): Model | null {
  return (
    models.find(
      (model) => model.is_draft && (model.dspark_target_models ?? []).includes(targetModelId),
    ) ?? null
  );
}

/** W_draft_gb = draft.params_total_b * quant.bytes_per_param * 1.05. */
export function dsparkDraftWeightsGb(draftModel: Model, quant: Quantization): number {
  return draftModel.params_total_b * quant.bytes_per_param * DSPARK_WEIGHTS_MULTIPLIER;
}

export function isDsparkActive(
  engine: Engine,
  useDSpark: boolean | undefined,
  draftModel: Model | null | undefined,
): boolean {
  return Boolean(useDSpark && engine.supports_dspark && draftModel);
}

export function dsparkSpeedupFor(
  engine: Engine,
  useDSpark: boolean | undefined,
  draftModel: Model | null | undefined,
): number {
  if (!isDsparkActive(engine, useDSpark, draftModel)) return 1;
  return engine.id === 'llama_cpp' ? DSPARK_SPEEDUP_LLAMA_CPP : DSPARK_SPEEDUP_DEFAULT;
}

export function dsparkWarning(
  engine: Engine,
  useDSpark: boolean | undefined,
  draftModel: Model | null | undefined,
): string | null {
  if (!useDSpark) return null;
  if (!engine.supports_dspark) {
    return `DSpark не поддерживается движком ${engine.name}: ускорение не применено, draft-модель не учитывается.`;
  }
  if (!draftModel) {
    return 'DSpark включён, но для выбранной модели нет draft-модели: ускорение не применено.';
  }
  return null;
}

/** §4.3. head_dim и n_kv_heads берутся из каталога (config.json), а не выводятся. */
export function kvPerTokenGb(model: Model, quant: Quantization): number {
  return (2 * model.n_layers * model.n_kv_heads * model.head_dim * quant.kv_bytes_per_elem) / 1e9;
}

/** §4.4. */
export function overheadGb(gpuCount: number, engine: Engine): number {
  return CUDA_CONTEXT_GB * gpuCount + engine.overhead_gb;
}

export function workspaceGb(vramTotalGb: number): number {
  return WORKSPACE_RATIO * Math.max(0, vramTotalGb);
}

export function interconnectOf(gpus: Gpu[]): Interconnect {
  if (gpus.length === 0) return 'pcie';
  if (gpus.every((gpu) => gpu.interconnect === 'unified' || gpu.unified_memory)) return 'unified';
  if (gpus.every((gpu) => gpu.nvlink || gpu.interconnect === 'nvlink')) return 'nvlink';
  if (gpus.every((gpu) => gpu.interconnect === 'infinity_fabric')) return 'infinity_fabric';
  return 'pcie';
}

export function ncclBufferGb(gpuCount: number, engine: Engine, interconnect: Interconnect): number {
  if (gpuCount <= 1 || !engine.supports_tp) return 0;
  return interconnect === 'nvlink' || interconnect === 'infinity_fabric' ? NCCL_NVLINK_GB : NCCL_PCIE_GB;
}

export interface MemoryInput {
  gpus: Gpu[];
  model: Model;
  quant: Quantization;
  engine: Engine;
  contextTokens: number;
  users: number;
  utilTarget?: number;
  useDSpark?: boolean;
  draftModel?: Model | null;
}

export interface FullMemoryResult {
  gpuCount: number;
  contextTokens: number;
  users: number;
  utilTarget: number;
  vramPerGpuGb: number;
  vramPhysicalGb: number;
  vramTotalGb: number;
  weightsGb: number;
  draftWeightsGb: number;
  kvPerTokenGb: number;
  kvRequiredGb: number;
  overheadGb: number;
  workspaceGb: number;
  kvPoolGb: number;
  ncclBufferGb: number;
  perGpuFootprintGb: number;
  fitPerGpu: boolean;
  spareRatio: number;
  maxParallel: number;
  interconnect: Interconnect;
}

/** §4.1–4.6. Полное размещение в VRAM. */
export function computeFullMemory(input: MemoryInput): FullMemoryResult {
  const { gpus, model, quant, engine, users } = input;
  const gpuCount = gpus.length;
  const contextTokens = effectiveContext(model, input.contextTokens);
  const utilTarget = utilTargetFor(engine, input.utilTarget);
  const vramPerGpuGb = gpuCount > 0 ? gpuCount > 0 ? minGpuVramGb(gpus) : 0 : 0;
  const vramPhysicalGb = totalPhysicalVramGb(gpus);
  const vramTotalGb = vramPhysicalGb * utilTarget;
  const draftWeights = isDsparkActive(engine, input.useDSpark, input.draftModel) && input.draftModel
    ? dsparkDraftWeightsGb(input.draftModel, quant)
    : 0;
  const weights = weightsGb(model, quant) + draftWeights;
  const perToken = kvPerTokenGb(model, quant);
  const kvRequired = perToken * contextTokens * users;
  const overhead = overheadGb(gpuCount, engine);
  const workspace = workspaceGb(vramTotalGb);
  const kvPool = vramTotalGb - weights - overhead - workspace;
  const interconnect = interconnectOf(gpus);
  const nccl = ncclBufferGb(gpuCount, engine, interconnect);
  const perGpu = gpuCount > 0 ? weights / gpuCount + kvPool / gpuCount + CUDA_CONTEXT_GB + nccl : Infinity;
  const fitPerGpu = gpuCount > 0 && perGpu <= vramPerGpuGb + 1e-9;
  const spareRatio = vramTotalGb > 0 ? kvPool / vramTotalGb : 0;
  const maxParallel =
    kvPool <= 0 || perToken <= 0 || contextTokens <= 0
      ? 0
      : Math.floor(kvPool / (perToken * contextTokens));

  return {
    gpuCount,
    contextTokens,
    users,
    utilTarget,
    vramPerGpuGb,
    vramPhysicalGb,
    vramTotalGb,
    weightsGb: weights,
    draftWeightsGb: draftWeights,
    kvPerTokenGb: perToken,
    kvRequiredGb: kvRequired,
    overheadGb: overhead,
    workspaceGb: workspace,
    kvPoolGb: kvPool,
    ncclBufferGb: nccl,
    perGpuFootprintGb: perGpu,
    fitPerGpu,
    spareRatio,
    maxParallel,
    interconnect,
  };
}

export interface OffloadResult {
  supported: true;
  layerSizeGb: number;
  offloadedLayers: number;
  weightsOnGpuGb: number;
  weightsOffloadedGb: number;
  draftWeightsGb: number;
  offloadRatio: number;
  kvPerTokenGb: number;
  kvRequiredGb: number;
  kvPoolGb: number;
  maxParallel: number;
  perGpuFootprintGb: number;
  fitPerGpu: boolean;
  feasible: boolean;
  speedPenalty: number;
  ramMinGb: number;
  vramUsedGb: number;
}

/**
 * §4.11 + offload. Offload разрешён только движкам с offload_supported (llama.cpp).
 * Выгружаем целыми слоями, чтобы не получать произвольную долю веса.
 */
export function computeOffloadMemory(input: MemoryInput): OffloadResult | null {
  const { gpus, model, quant, engine, users } = input;
  if (!engine.offload_supported || gpus.length === 0) return null;

  const contextTokens = effectiveContext(model, input.contextTokens);
  const utilTarget = utilTargetFor(engine, input.utilTarget);
  const gpuCount = gpus.length;
  const vramTotal = totalPhysicalVramGb(gpus) * utilTarget;
  const draftWeights = isDsparkActive(engine, input.useDSpark, input.draftModel) && input.draftModel
    ? dsparkDraftWeightsGb(input.draftModel, quant)
    : 0;
  const weights = weightsGb(model, quant) + draftWeights;
  const perToken = kvPerTokenGb(model, quant);
  const kvRequired = perToken * contextTokens * users;
  const overhead = overheadGb(gpuCount, engine);
  const workspace = workspaceGb(vramTotal);
  const nonWeight = overhead + workspace + kvRequired;
  const weightCapacity = Math.max(0, vramTotal - nonWeight);

  const layerSize = model.n_layers > 0 ? weights / model.n_layers : weights;
  const rawOffload = Math.max(0, weights - weightCapacity);
  const offloadedLayers =
    rawOffload <= 1e-9 || layerSize <= 0 ? 0 : Math.min(model.n_layers, Math.ceil(rawOffload / layerSize - 1e-9));
  const weightsOffloaded = Math.min(weights, offloadedLayers * layerSize);
  const weightsOnGpu = Math.max(0, weights - weightsOffloaded);
  const offloadRatio = weights > 0 ? weightsOffloaded / weights : 0;

  const kvPool = vramTotal - weightsOnGpu - overhead - workspace;
  const maxParallel =
    kvPool <= 0 || perToken <= 0 ? 0 : Math.floor(kvPool / (perToken * contextTokens));

  const interconnect = interconnectOf(gpus);
  const nccl = ncclBufferGb(gpuCount, engine, interconnect);
  const perGpu = weightsOnGpu / gpuCount + kvRequired / gpuCount + CUDA_CONTEXT_GB + nccl;
  const fitPerGpu = perGpu <= minGpuVramGb(gpus) + 1e-9;

  const speedPenalty = clamp(1 / (1 + OFFLOAD_SPEED_ALPHA * offloadRatio), 0.08, 1);
  const ramMin = Math.max(weightsOffloaded + 6, 1.3 * weightsOffloaded);
  const vramUsed = weightsOnGpu + kvRequired + overhead + workspace;
  const feasible =
    offloadRatio <= MAX_OFFLOAD_RATIO &&
    fitPerGpu &&
    maxParallel >= users &&
    kvRequired > 0 &&
    vramUsed <= totalPhysicalVramGb(gpus) + 1e-9;

  return {
    supported: true,
    layerSizeGb: layerSize,
    offloadedLayers,
    weightsOnGpuGb: weightsOnGpu,
    weightsOffloadedGb: weightsOffloaded,
    draftWeightsGb: draftWeights,
    offloadRatio,
    kvPerTokenGb: perToken,
    kvRequiredGb: kvRequired,
    kvPoolGb: kvPool,
    maxParallel,
    perGpuFootprintGb: perGpu,
    fitPerGpu,
    feasible,
    speedPenalty,
    ramMinGb: ramMin,
    vramUsedGb: vramUsed,
  };
}

export function tpFactor(gpuCount: number, engine: Engine, interconnect: Interconnect): number {
  if (gpuCount <= 1) return 1;
  if (interconnect === 'unified') return 1;
  // ASSUMPTION: llama.cpp layer-split не делает all-reduce и масштабируется лучше PCIe TP.
  if (!engine.supports_tp) return 0.85;
  return interconnect === 'nvlink' || interconnect === 'infinity_fabric' ? 0.65 : 0.35;
}

export function speedEfficiency(gpuCount: number, engine: Engine, interconnect: Interconnect): number {
  if (gpuCount <= 1 || interconnect === 'unified') return 0.55;
  if (!engine.supports_tp) return 0.55; // layer-split
  return interconnect === 'nvlink' || interconnect === 'infinity_fabric' ? 0.65 : 0.4;
}

export function batchEfficiencyFor(maxParallel: number, profile: Profile): number {
  const base = maxParallel <= 8 ? 0.85 : maxParallel <= 32 ? 0.6 : 0.45;
  // ASSUMPTION: профиль сдвигает эффективность батча в пределах ±10%.
  return clamp(base * PROFILE_SETTINGS[profile].batchMultiplier, 0.3, 1);
}

export interface SpeedInput {
  gpus: Gpu[];
  model: Model;
  quant: Quantization;
  engine: Engine;
  maxParallel: number;
  profile: Profile;
  offloadRatio?: number;
  useDSpark?: boolean;
  draftModel?: Model | null;
}

/** §4.7–4.9. Decode, memory-bandwidth-bound. */
export function estimateSpeed(input: SpeedInput): SpeedEstimate {
  const { gpus, model, quant, engine, maxParallel, profile } = input;
  const gpuCount = gpus.length;
  const interconnect = interconnectOf(gpus);
  const tp = tpFactor(gpuCount, engine, interconnect);
  const eff = speedEfficiency(gpuCount, engine, interconnect);
  const bwEffective = sum(gpus.map((gpu) => gpu.bandwidth_gbs)) * tp;
  // Для MoE скорость определяется активными параметрами, для dense active === total.
  const bytesActive = Math.max(1, model.params_active_b * quant.bytes_per_param * 1e9);
  const raw = (bwEffective * 1e9 * eff) / bytesActive;
  const offloadRatio = clamp(input.offloadRatio ?? 0, 0, 1);
  const penalty = clamp(1 / (1 + OFFLOAD_SPEED_ALPHA * offloadRatio), 0.08, 1);
  const dsparkSpeedup = dsparkSpeedupFor(engine, input.useDSpark, input.draftModel);
  const tokPerSeq = raw * penalty * dsparkSpeedup;
  const batchEfficiency = batchEfficiencyFor(maxParallel, profile);
  const total = tokPerSeq * Math.max(0, maxParallel) * batchEfficiency;

  return {
    tokPerSeq,
    tokPerSeqMin: tokPerSeq * 0.7,
    tokPerSeqMax: tokPerSeq * 1.3,
    totalTokS: total,
    batchEfficiency,
    offloadPenalty: penalty,
    bwEffectiveGbs: bwEffective,
    efficiency: eff,
    tpFactor: tp,
    dsparkSpeedup,
  };
}

/** §4.13. */
export function psuWatts(totalGpuTdp: number, cpuTdp: number): number {
  return Math.ceil((totalGpuTdp + cpuTdp + 150) * 1.3);
}

export function roundUpTo(value: number, steps: number[]): number {
  for (const step of steps) if (value <= step) return step;
  return steps[steps.length - 1] ?? value;
}
