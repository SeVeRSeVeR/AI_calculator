import { describe, expect, it } from 'vitest';
import { computeFullMemory } from '../src/calc/core';
import { evaluateCatalog, evaluateModel, multiGpuAdvice } from '../src/calc/fit';
import { recommendPlatform } from '../src/calc/platform';
import { catalog, engine, gpu, gpuList, model, quant } from './fixtures';

describe('расчётное ядро и режим A', () => {
  it('1. RTX 3060 12GB, 8K, 1 пользователь, Q4_K_M: 8B влезает, 70B — нет', () => {
    const evaluations = evaluateCatalog(catalog.models, {
      gpus: gpuList('rtx3060', 1),
      quant: quant('q4_k_m'),
      engine: engine('llama_cpp'),
      contextTokens: 8192,
      users: 1,
      profile: 'chat',
    });
    const small = evaluations.find((item) => item.model.id === 'llama-3.1-8b');
    const large = evaluations.find((item) => item.model.id === 'llama-3.3-70b');
    const medium = evaluations.find((item) => item.model.id === 'qwen3-14b');

    expect(small).toBeDefined();
    expect(small?.status).toBe('FITS_FULL');
    expect(small?.weightsInVramGb).toBeCloseTo(8.03 * 0.55 * 1.05, 2);
    expect(small?.kvGb).toBeCloseTo((2 * 32 * 8 * 128 * 2 * 8192) / 1e9, 2);
    expect(large?.status).toBe('NO_FIT');
    // 14B влезает только с небольшим offload — это ожидаемое поведение исправленных формул.
    expect(medium?.status).not.toBe('FITS_FULL');
  });

  it('2. 2×RTX 4090 без NVLink, 70B Q4, 8K, 2 пользователя: не FITS_FULL и предупреждение о PCIe TP', () => {
    const evaluation = evaluateModel({
      gpus: gpuList('rtx4090', 2),
      model: model('llama-3.3-70b'),
      quant: quant('q4_k_m'),
      engine: engine('llama_cpp'),
      contextTokens: 8192,
      users: 2,
      profile: 'chat',
    });
    const advice = multiGpuAdvice(gpuList('rtx4090', 2), engine('llama_cpp'));

    // При строгих формулах (1.5 ГБ CUDA context на карту + 5% workspace + 5% weights)
    // 70B Q4 не помещается в 2×24 ГБ полностью, но помещается с offload ~12%.
    // В ASSUMPTIONS.md зафиксировано расхождение с иллюстративным FITS_TIGHT из ТЗ.
    expect(evaluation.status).toBe('FITS_WITH_RAM');
    expect(evaluation.offloadRatio).toBeGreaterThan(0);
    expect(evaluation.offloadRatio).toBeLessThanOrEqual(0.5);
    expect(evaluation.perGpuFootprintGb).toBeLessThanOrEqual(24);
    expect(advice.interconnect).toBe('pcie');
    expect(advice.warning).toContain('PCIe');
  });

  it('3. 4×A100 80GB: 70B FP16 32K на 50 пользователей не обслуживает, FP8 8K — обслуживает', () => {
    const strict = evaluateModel({
      gpus: gpuList('a100_sxm', 4),
      model: model('llama-3.3-70b'),
      quant: quant('fp16'),
      engine: engine('vllm'),
      contextTokens: 32768,
      users: 50,
      profile: 'rag',
    });
    expect(strict.status).toBe('FITS_FULL');
    // KV-кеш 50 × 32K × FP16 физически не помещается в 320 ГБ вместе с весами.
    expect(strict.maxParallel).toBeLessThan(50);
    expect(strict.servesRequestedUsers).toBe(false);

    const realistic = evaluateModel({
      gpus: gpuList('a100_sxm', 4),
      model: model('llama-3.3-70b'),
      quant: quant('fp8'),
      engine: engine('vllm'),
      contextTokens: 8192,
      users: 50,
      profile: 'rag',
    });
    expect(realistic.status).toBe('FITS_FULL');
    expect(realistic.maxParallel).toBeGreaterThanOrEqual(50);
    expect(realistic.servesRequestedUsers).toBe(true);
  });

  it('4. RTX 3060 12GB, 8B FP16: NO_FIT, но рекомендация RAM/CPU непустая', () => {
    const evaluation = evaluateModel({
      gpus: gpuList('rtx3060', 1),
      model: model('llama-3.1-8b'),
      quant: quant('fp16'),
      engine: engine('vllm'),
      contextTokens: 8192,
      users: 1,
      profile: 'chat',
    });
    expect(evaluation.status).toBe('NO_FIT');

    const platform = recommendPlatform({
      gpus: gpuList('rtx3060', 1),
      cpus: catalog.cpus,
      weightsGb: evaluation.full.weightsGb,
      weightsOffloadedGb: evaluation.full.weightsGb,
      offloadRatio: 0.8,
    });
    expect(platform.ramGb).toBeGreaterThanOrEqual(32);
    expect(platform.cpu.name.length).toBeGreaterThan(3);
    expect(platform.psuW).toBeGreaterThanOrEqual(650);
    expect(platform.nvmeGb).toBeGreaterThanOrEqual(1024);
  });

  it('5. MoE: веса по params_total_b, скорость по params_active_b', () => {
    const evaluation = evaluateModel({
      gpus: gpuList('rtx4090', 2),
      model: model('qwen3-30b-a3b'),
      quant: quant('awq_4bit'),
      engine: engine('vllm'),
      contextTokens: 8192,
      users: 2,
      profile: 'chat',
    });
    expect(evaluation.model.params_total_b).toBe(30.5);
    expect(evaluation.model.params_active_b).toBe(3.3);
    expect(evaluation.full.weightsGb).toBeCloseTo(30.5 * 0.55 * 1.05, 2);
    expect(evaluation.speed.tokPerSeq).toBeGreaterThan(100);
    // Если бы использовался total, скорость была бы ~в 9 раз ниже.
    expect(evaluation.speed.tokPerSeq / 9).toBeLessThan(30);
  });

  it('10. Per-GPU проверка: 2×24GB, 70B Q4, 8K — footprint на карту, а не на 48 ГБ', () => {
    const full = computeFullMemory({
      gpus: gpuList('rtx4090', 2),
      model: model('llama-3.3-70b'),
      quant: quant('q4_k_m'),
      engine: engine('llama_cpp'),
      contextTokens: 8192,
      users: 2,
    });
    expect(full.vramPhysicalGb).toBe(48);
    expect(full.perGpuFootprintGb).toBeLessThanOrEqual(gpu('rtx4090').vram_gb);
    expect(full.perGpuFootprintGb).toBeGreaterThan(12);
    // Полное размещение при этом не проходит: KV-пул отрицательный.
    expect(full.kvPoolGb).toBeLessThan(0);
    expect(full.fitPerGpu).toBe(true);
  });

  it('11. DSpark: draft-модель в VRAM, ускорение 1.3×/1.5× и деградация fit на малой VRAM', () => {
    const llama = model('llama-3.1-8b');
    const draft = model('dspark-draft-llama-3.1-8b');
    const base = {
      gpus: gpuList('rtx4090', 1),
      model: llama,
      quant: quant('q4_k_m'),
      engine: engine('llama_cpp'),
      contextTokens: 8192,
      users: 1,
      profile: 'chat' as const,
    };

    const without = evaluateModel(base);
    const withDSpark = evaluateModel({ ...base, useDSpark: true, draftModel: draft });
    const expectedDraftGb = 0.5 * 0.55 * 1.05;

    expect(withDSpark.full.draftWeightsGb).toBeCloseTo(expectedDraftGb, 3);
    expect(withDSpark.full.weightsGb - without.full.weightsGb).toBeCloseTo(expectedDraftGb, 3);
    expect(withDSpark.speed.tokPerSeq / without.speed.tokPerSeq).toBeCloseTo(1.3, 3);
    expect(withDSpark.status).toBe(without.status);

    const vllmBase = {
      ...base,
      quant: quant('awq_4bit'),
      engine: engine('vllm'),
    };
    const vllmWithout = evaluateModel(vllmBase);
    const vllmWithDSpark = evaluateModel({ ...vllmBase, useDSpark: true, draftModel: draft });
    expect(vllmWithDSpark.speed.tokPerSeq / vllmWithout.speed.tokPerSeq).toBeCloseTo(1.5, 3);

    const tgiWithDSpark = evaluateModel({
      ...vllmBase,
      engine: engine('tgi'),
      useDSpark: true,
      draftModel: draft,
    });
    expect(tgiWithDSpark.speed.dsparkSpeedup).toBe(1);
    expect(tgiWithDSpark.dsparkWarning).toContain('не поддерживается');
    expect(tgiWithDSpark.full.draftWeightsGb).toBe(0);

    // 3060 12GB: умеренно большая draft-модель уводит конфигурацию в offload.
    const offloadEval = evaluateModel({
      gpus: gpuList('rtx3060', 1),
      model: llama,
      quant: quant('q4_k_m'),
      engine: engine('llama_cpp'),
      contextTokens: 8192,
      users: 1,
      profile: 'chat',
      useDSpark: true,
      draftModel: { ...draft, params_total_b: 8 },
    });
    expect(offloadEval.status).toBe('FITS_WITH_RAM');
    expect(offloadEval.weightsOffloadedGb).toBeGreaterThan(0);

    // Слишком большая draft-модель не помещается даже с offload.
    const noFitEval = evaluateModel({
      gpus: gpuList('rtx3060', 1),
      model: llama,
      quant: quant('q4_k_m'),
      engine: engine('llama_cpp'),
      contextTokens: 8192,
      users: 1,
      profile: 'chat',
      useDSpark: true,
      draftModel: { ...draft, params_total_b: 64 },
    });
    expect(noFitEval.status).toBe('NO_FIT');
    expect(noFitEval.reason).toBe('DSPARK_DRAFT_DOES_NOT_FIT');
  });
});
