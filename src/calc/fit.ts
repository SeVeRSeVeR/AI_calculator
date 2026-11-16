import type { Engine, FitReason, FitStatus, Gpu, Model, Profile, Quantization, SpeedEstimate } from '../data/types';
import {
  computeFullMemory,
  computeOffloadMemory,
  dsparkWarning,
  estimateSpeed,
  findDraftModel,
  isDsparkActive,
  type FullMemoryResult,
  type MemoryInput,
  type OffloadResult,
} from './core';

export interface EvaluationInput extends MemoryInput {
  profile: Profile;
}

export interface ModelEvaluation {
  model: Model;
  quant: Quantization;
  status: FitStatus;
  reason: FitReason;
  full: FullMemoryResult;
  offload: OffloadResult | null;
  /** Веса, находящиеся в VRAM. */
  weightsInVramGb: number;
  /** Веса, выгруженные в RAM. */
  weightsOffloadedGb: number;
  kvGb: number;
  vramUsedGb: number;
  totalMemoryGb: number;
  offloadRatio: number;
  maxParallel: number;
  perGpuFootprintGb: number;
  spareRatio: number;
  servesRequestedUsers: boolean;
  speed: SpeedEstimate;
  draftWeightsGb: number;
  dsparkSpeedup: number;
  dsparkRequested: boolean;
  dsparkWarning: string | null;
}

const STATUS_ORDER: Record<FitStatus, number> = {
  FITS_FULL: 0,
  FITS_TIGHT: 1,
  FITS_WITH_RAM: 2,
  NO_FIT: 3,
};

export function statusRank(status: FitStatus): number {
  return STATUS_ORDER[status];
}

export function evaluateModel(input: EvaluationInput): ModelEvaluation {
  const full = computeFullMemory(input);
  const offload = computeOffloadMemory(input);
  let status: FitStatus = 'NO_FIT';
  let reason: FitReason = 'KV_POOL_EXHAUSTED';

  if (full.fitPerGpu && full.kvPoolGb > 0) {
    // §4.10: запас VRAM = KV_pool / VRAM_total.
    status = full.spareRatio >= 0.15 ? 'FITS_FULL' : 'FITS_TIGHT';
    reason = 'OK';
  } else if (offload && offload.offloadRatio > 0) {
    if (offload.feasible) {
      status = 'FITS_WITH_RAM';
      reason = 'OK';
    } else if (offload.offloadRatio > 0.5) {
      reason = 'OFFLOAD_TOO_LARGE';
    } else if (!offload.fitPerGpu) {
      reason = 'PER_GPU_OVERFLOW';
    } else if (offload.maxParallel < Math.max(1, input.users)) {
      reason = 'KV_DOES_NOT_FIT';
    } else {
      reason = 'KV_DOES_NOT_FIT';
    }
  } else if (full.kvPoolGb <= 0 || full.kvRequiredGb > full.kvPoolGb) {
    reason = 'KV_POOL_EXHAUSTED';
  } else if (!full.fitPerGpu) {
    reason = 'PER_GPU_OVERFLOW';
  } else if (!input.engine.offload_supported) {
    reason = 'OFFLOAD_UNSUPPORTED';
  }

  // Если без draft-модели конфигурация помещалась, а с DSpark — нет,
  // сообщаем именно о нехватке памяти под draft-модель.
  if (status === 'NO_FIT' && isDsparkActive(input.engine, input.useDSpark, input.draftModel)) {
    const noDraftInput = { ...input, useDSpark: false, draftModel: null };
    const noDraftFull = computeFullMemory(noDraftInput);
    const noDraftOffload = computeOffloadMemory(noDraftInput);
    const targetWouldFit =
      (noDraftFull.fitPerGpu && noDraftFull.kvPoolGb > 0) || Boolean(noDraftOffload?.feasible);
    if (targetWouldFit) reason = 'DSPARK_DRAFT_DOES_NOT_FIT';
  }

  const useOffload = status === 'FITS_WITH_RAM' && offload;
  const weightsInVram = useOffload ? offload.weightsOnGpuGb : full.weightsGb;
  const weightsOffloaded = useOffload ? offload.weightsOffloadedGb : 0;
  const kvGb = useOffload ? offload.kvRequiredGb : full.kvRequiredGb;
  const vramUsed = useOffload ? offload.vramUsedGb : full.weightsGb + full.kvRequiredGb + full.overheadGb + full.workspaceGb;
  const maxParallel = useOffload ? offload.maxParallel : full.maxParallel;
  const perGpu = useOffload ? offload.perGpuFootprintGb : full.perGpuFootprintGb;
  const offloadRatio = useOffload ? offload.offloadRatio : 0;
  const spareRatio = full.spareRatio;

  const speed = estimateSpeed({
    gpus: input.gpus,
    model: input.model,
    quant: input.quant,
    engine: input.engine,
    maxParallel,
    profile: input.profile,
    offloadRatio,
    useDSpark: input.useDSpark,
    draftModel: input.draftModel,
  });

  const draftWeightsGb = useOffload ? offload.draftWeightsGb : full.draftWeightsGb;

  return {
    model: input.model,
    quant: input.quant,
    status,
    reason,
    full,
    offload,
    weightsInVramGb: weightsInVram,
    weightsOffloadedGb: weightsOffloaded,
    kvGb,
    vramUsedGb: vramUsed,
    totalMemoryGb: vramUsed + weightsOffloaded,
    offloadRatio,
    maxParallel,
    perGpuFootprintGb: perGpu,
    spareRatio,
    servesRequestedUsers: maxParallel >= input.users,
    speed,
    draftWeightsGb,
    dsparkSpeedup: speed.dsparkSpeedup,
    dsparkRequested: Boolean(input.useDSpark),
    dsparkWarning: dsparkWarning(input.engine, input.useDSpark, input.draftModel),
  };
}

export function evaluateCatalog(
  models: Model[],
  base: Omit<EvaluationInput, 'model'>,
): ModelEvaluation[] {
  return models
    .filter((model) => model.status === 'released' && !model.is_draft)
    .map((model) =>
      evaluateModel({
        ...base,
        model,
        draftModel: base.useDSpark ? findDraftModel(models, model.id) : base.draftModel ?? null,
      }),
    )
    .sort((a, b) => {
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;
      return b.model.params_total_b - a.model.params_total_b;
    });
}

export function multiGpuAdvice(gpus: Gpu[], engine: Engine): {
  interconnect: 'nvlink' | 'pcie' | 'infinity_fabric' | 'unified';
  warning: string | null;
  recommendation: string | null;
} {
  const interconnect = gpus.every((gpu) => gpu.nvlink || gpu.interconnect === 'nvlink')
    ? 'nvlink'
    : gpus.every((gpu) => gpu.interconnect === 'infinity_fabric')
      ? 'infinity_fabric'
      : gpus.every((gpu) => gpu.interconnect === 'unified' || gpu.unified_memory)
        ? 'unified'
        : 'pcie';

  if (gpus.length <= 1) return { interconnect, warning: null, recommendation: null };

  if (interconnect === 'nvlink' || interconnect === 'infinity_fabric') {
    return {
      interconnect,
      warning: null,
      recommendation: `Интерконнект ${interconnect === 'nvlink' ? 'NVLink' : 'Infinity Fabric'} позволяет использовать TP с меньшими потерями.`,
    };
  }

  if (interconnect === 'unified') {
    return {
      interconnect,
      warning: null,
      recommendation: 'Unified memory: отдельный tensor parallelism не нужен, память общая.',
    };
  }

  return {
    interconnect,
    warning:
      'TP через PCIe без NVLink теряет 60–70% агрегатной пропускной способности на all-reduce. Оценка tok/s уже учитывает этот штраф.',
    recommendation:
      engine.supports_tp
        ? 'Для моделей, которые целиком помещаются на одну карту, TP не нужен. Если нужен мульти-GPU, рассмотрите llama.cpp layer-split или NVLink-платформу.'
        : 'llama.cpp использует layer-split: веса делятся по слоям, all-reduce не требуется. Это предпочтительнее vLLM TP на PCIe.',
  };
}
