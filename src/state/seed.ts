import type { Catalog } from '../data/types';
import { DEFAULT_MODE_A, DEFAULT_MODE_B, PROFILES, type Mode, type ModeAForm, type ModeBForm } from './forms';
import type { Seed } from './query';
import { defaultQuantForEngine } from '../data/loader';

function clampInt(value: number | '', min: number, max: number, fallback: number | ''): number | '' {
  if (value === '' || !Number.isFinite(Number(value)) || !Number.isInteger(Number(value))) return fallback;
  return Math.min(max, Math.max(min, Number(value)));
}

export function mergeSeed(
  catalog: Catalog,
  seed: Seed | null,
): {
  mode: Mode;
  a: ModeAForm;
  b: ModeBForm;
  ignored: boolean;
} {
  const a: ModeAForm = { ...DEFAULT_MODE_A };
  const b: ModeBForm = { ...DEFAULT_MODE_B };
  let mode: Mode = seed?.mode ?? 'a';
  let ignored = seed?.ignored ?? false;

  if (!seed) return { mode, a, b, ignored };

  const rawA = seed.a ?? {};
  const rawB = seed.b ?? {};
  // Общие query-параметры (ctx, u, q, profile) применяются к обеим формам.
  // Предупреждаем о несовместимости только для активного режима, иначе
  // корректная ссылка режима B ругалась бы на q из формы A и наоборот.
  const activeMode: Mode = seed.mode ?? (rawB.modelId ? 'b' : 'a');

  if (rawA.engineId) {
    if (catalog.engines.some((engine) => engine.id === rawA.engineId)) a.engineId = rawA.engineId;
    else if (activeMode === 'a') ignored = true;
  }

  if (rawA.quantId) {
    const quant = catalog.quantizations.find((item) => item.id === rawA.quantId);
    const engine = catalog.engines.find((item) => item.id === a.engineId);
    if (quant && engine && quant.family === engine.quant_family) a.quantId = quant.id;
    else {
      a.quantId = defaultQuantForEngine(catalog, a.engineId).id;
      if (activeMode === 'a') ignored = true;
    }
  } else {
    a.quantId = defaultQuantForEngine(catalog, a.engineId).id;
  }

  if (rawA.gpuId) {
    if (catalog.gpus.some((gpu) => gpu.id === rawA.gpuId)) a.gpuId = rawA.gpuId;
    else if (activeMode === 'a') ignored = true;
  }

  a.gpuCount = clampInt(rawA.gpuCount ?? a.gpuCount, 1, 8, 1);
  a.context = clampInt(rawA.context ?? a.context, 1, 1_048_576, 8192);
  a.users = clampInt(rawA.users ?? a.users, 1, 10_000, 1);
  if (typeof rawA.useDSpark === 'boolean') a.useDSpark = rawA.useDSpark;
  if (rawA.targetToks !== undefined) a.targetToks = clampInt(rawA.targetToks, 1, 1_000, '');
  if (rawA.utilTarget !== undefined) {
    const util = Number(rawA.utilTarget);
    a.utilTarget = Number.isFinite(util) && util >= 0.8 && util <= 0.95 ? util : '';
  }
  if (rawA.profile && PROFILES.includes(rawA.profile)) a.profile = rawA.profile;

  if (rawB.modelId) {
    if (catalog.models.some((model) => model.id === rawB.modelId && !model.is_draft)) b.modelId = rawB.modelId;
    else if (activeMode === 'b') ignored = true;
  }
  if (rawB.quantId) {
    if (catalog.quantizations.some((quant) => quant.id === rawB.quantId)) b.quantId = rawB.quantId;
    else if (activeMode === 'b') ignored = true;
  }
  b.context = clampInt(rawB.context ?? b.context, 1, 1_048_576, 8192);
  b.users = clampInt(rawB.users ?? b.users, 1, 10_000, 1);
  b.targetToks = clampInt(rawB.targetToks ?? b.targetToks, 1, 1_000, 15);
  if (rawB.profile && PROFILES.includes(rawB.profile)) b.profile = rawB.profile;
  if (typeof rawB.useDSpark === 'boolean') b.useDSpark = rawB.useDSpark;

  if (seed.mode === 'b' || b.modelId) mode = 'b';
  if (seed.mode === 'a') mode = 'a';

  return { mode, a, b, ignored };
}
