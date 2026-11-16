import { describe, expect, it } from 'vitest';
import { buildConfigurations } from '../src/calc/configs';
import { catalog, model, quant } from './fixtures';

describe('режим B: три конфигурации', () => {
  it('6. 8B Q4, 4K, 5 пользователей — три различимые конфигурации', () => {
    const result = buildConfigurations({
      catalog,
      model: model('llama-3.1-8b'),
      quant: quant('q4_k_m'),
      contextTokens: 4096,
      users: 5,
      targetToks: 15,
      profile: 'chat',
    });
    expect(result.status).toBe('OK');
    expect(result.min).not.toBeNull();
    expect(result.optimal).not.toBeNull();
    expect(result.max).not.toBeNull();
    expect(result.maxEqualsOptimal).toBe(false);
    expect(`${result.min?.gpu.id}-${result.min?.gpuCount}`).not.toBe(`${result.optimal?.gpu.id}-${result.optimal?.gpuCount}`);
    expect(result.optimal!.physicalVramGb).toBeGreaterThanOrEqual(result.min!.physicalVramGb);
    expect(result.max!.physicalVramGb).toBeGreaterThanOrEqual(result.optimal!.physicalVramGb);
    expect(result.optimal!.weightsOffloadedGb).toBe(0);
    expect(result.optimal!.maxParallel).toBeGreaterThanOrEqual(5);
    expect(result.optimal!.speed.tokPerSeq).toBeGreaterThanOrEqual(15);
    expect(result.min!.offloadRatio).toBeLessThanOrEqual(0.4);
  });

  it('7. 70B FP16, 128K, 100 пользователей — IMPOSSIBLE с рекомендациями', () => {
    const result = buildConfigurations({
      catalog,
      model: model('llama-3.3-70b'),
      quant: quant('fp16'),
      contextTokens: 131072,
      users: 100,
      targetToks: 15,
      profile: 'rag',
    });
    expect(result.status).toBe('IMPOSSIBLE');
    expect(result.optimal).toBeNull();
    expect(result.reason).toBeTruthy();
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((item) => item.kind === 'context')).toBe(true);
    expect(result.recommendations.some((item) => item.kind === 'quant')).toBe(true);
  });

  it('8. MAX не требуется, когда каталог исчерпан: гигантская MoE, 4K, 1000 пользователей', () => {
    const result = buildConfigurations({
      catalog,
      model: model('deepseek-v4-pro'),
      quant: quant('q4_k_m'),
      contextTokens: 4096,
      users: 1000,
      targetToks: 15,
      profile: 'batch',
    });
    expect(result.status).toBe('OK');
    expect(result.optimal).not.toBeNull();
    expect(result.max).toBeNull();
    expect(result.maxEqualsOptimal).toBe(true);
    expect(result.optimal!.maxParallel).toBeGreaterThanOrEqual(1000);
    // Инвариант RAM: OPTIMAL не ниже offload-MIN.
    if (result.min) {
      expect(result.optimal!.platform.ramGb).toBeGreaterThanOrEqual(result.min.platform.ramGb);
      expect(result.optimal!.physicalVramGb).toBeGreaterThanOrEqual(result.min.physicalVramGb);
    }
  });
});
