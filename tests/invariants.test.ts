import { describe, expect, it } from 'vitest';
import { buildConfigurations } from '../src/calc/configs';
import { catalog, quant } from './fixtures';

describe('инварианты конфигураций', () => {
  it(
    '9. min ≤ optimal ≤ max по VRAM, RAM, cores, PSU на сетке моделей/контекстов/пользователей',
    () => {
      const modelIds = [
        'llama-3.1-8b',
        'llama-3.3-70b',
        'qwen3-14b',
        'qwen3-32b',
        'qwen3-30b-a3b',
        'qwen3-235b-a22b',
        'gemma-3-27b',
        'gemma-3-12b',
        'mistral-small-3.2-24b',
        'mixtral-8x7b',
        'mixtral-8x22b',
        'deepseek-v3',
        'deepseek-v4-flash',
        'deepseek-v4-pro',
        'llama-4-scout',
        'llama-4-maverick',
        'kimi-k2.6',
        'glm-4.5-air',
        'gpt-oss-120b',
        'hermes-does-not-exist',
      ];
      const existing = modelIds
        .map((id) => catalog.models.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      // Добираем до 20 реальными моделями каталога, если часть id переименована.
      for (const item of catalog.models) {
        if (existing.length >= 20) break;
        if (!existing.some((modelItem) => modelItem.id === item.id)) existing.push(item);
      }

      const contexts = [4096, 8192, 32768, 131072, 1048576];
      const users = [1, 8, 64];
      let checked = 0;
      let impossible = 0;

      for (const item of existing.slice(0, 20)) {
        for (const contextTokens of contexts) {
          for (const count of users) {
            const result = buildConfigurations({
              catalog,
              model: item,
              quant: quant('q4_k_m'),
              contextTokens: Math.min(contextTokens, item.max_context),
              users: count,
              targetToks: 15,
              profile: 'chat',
            });
            if (result.status !== 'OK') {
              impossible += 1;
              continue;
            }
            expect(result.min).not.toBeNull();
            expect(result.optimal).not.toBeNull();
            checked += 1;

            const min = result.min!;
            const optimal = result.optimal!;
            expect(min.physicalVramGb).toBeLessThanOrEqual(optimal.physicalVramGb);
            expect(min.platform.ramGb).toBeLessThanOrEqual(optimal.platform.ramGb);
            expect(min.platform.cpu.cores).toBeLessThanOrEqual(optimal.platform.cpu.cores);
            expect(min.platform.psuW).toBeLessThanOrEqual(optimal.platform.psuW);

            if (result.max) {
              expect(optimal.physicalVramGb).toBeLessThanOrEqual(result.max.physicalVramGb);
              expect(optimal.platform.ramGb).toBeLessThanOrEqual(result.max.platform.ramGb);
              expect(optimal.platform.cpu.cores).toBeLessThanOrEqual(result.max.platform.cpu.cores);
              expect(optimal.platform.psuW).toBeLessThanOrEqual(result.max.platform.psuW);
            } else {
              expect(result.maxEqualsOptimal).toBe(true);
            }
          }
        }
      }

      expect(checked).toBeGreaterThan(20);
      expect(impossible).toBeGreaterThan(0);
    },
    120_000,
  );
});
