import { describe, expect, it } from 'vitest';
import { DEFAULT_MODE_A, DEFAULT_MODE_B } from '../src/state/forms';
import { buildShareParams, readSeed } from '../src/state/query';
import { mergeSeed } from '../src/state/seed';
import { validateModeA, validateModeB } from '../src/state/validation';
import { catalog, model } from './fixtures';

function withWindow<T>(search: string, callback: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      location: { search, href: `https://example.test/${search}` },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    },
  });
  try {
    return callback();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete (globalThis as { window?: unknown }).window;
  }
}

describe('валидация и ссылки', () => {
  it('11. Пустые, отрицательные, дробные, текстовые значения и context > max_context', () => {
    const base = { ...DEFAULT_MODE_A, gpuId: 'rtx4090' };
    expect(validateModeA(base, catalog).valid).toBe(true);
    expect(validateModeA({ ...base, gpuId: '' }, catalog).errors.gpuId).toBeTruthy();
    expect(validateModeA({ ...base, gpuCount: 0 }, catalog).errors.gpuCount).toBeTruthy();
    expect(validateModeA({ ...base, gpuCount: 9 }, catalog).errors.gpuCount).toBeTruthy();
    expect(validateModeA({ ...base, gpuCount: 2.5 }, catalog).errors.gpuCount).toBeTruthy();
    expect(validateModeA({ ...base, context: -1 }, catalog).errors.context).toBeTruthy();
    expect(validateModeA({ ...base, context: 1_048_577 }, catalog).errors.context).toBeTruthy();
    expect(validateModeA({ ...base, users: 0 }, catalog).errors.users).toBeTruthy();
    expect(validateModeA({ ...base, users: 10_001 }, catalog).errors.users).toBeTruthy();
    expect(validateModeA({ ...base, users: 1.5 }, catalog).errors.users).toBeTruthy();
    expect(
      validateModeA({ ...base, context: 'abc' as unknown as number }, catalog).errors.context,
    ).toBeTruthy();
    expect(validateModeA({ ...base, utilTarget: 0.99 }, catalog).errors.utilTarget).toBeTruthy();

    const llama = model('llama-3.1-8b');
    const tooLong = validateModeB(
      { ...DEFAULT_MODE_B, modelId: llama.id, context: llama.max_context + 1, targetToks: 15 },
      catalog,
      llama,
    );
    expect(tooLong.valid).toBe(false);
    expect(tooLong.errors.context).toContain('131');
    expect(
      validateModeB(
        { ...DEFAULT_MODE_B, modelId: llama.id, context: 10, users: 1, targetToks: 15 },
        catalog,
        llama,
      ).warnings.context,
    ).toBeTruthy();
  });

  it('12. Share-link сериализуется и восстанавливается из query', () => {
    const b = {
      ...DEFAULT_MODE_B,
      modelId: 'llama-3.1-8b',
      quantId: 'q4_k_m',
      context: 16384,
      users: 7,
      targetToks: 22,
      profile: 'code' as const,
    };
    const params = buildShareParams('b', DEFAULT_MODE_A, b);
    expect(params.get('mode')).toBe('b');
    expect(params.get('model')).toBe('llama-3.1-8b');
    expect(params.get('ctx')).toBe('16384');
    expect(params.get('u')).toBe('7');

    const seed = withWindow(`?${params.toString()}`, () => readSeed());
    expect(seed?.fromQuery).toBe(true);
    expect(seed?.mode).toBe('b');
    expect(seed?.b?.modelId).toBe('llama-3.1-8b');
    expect(seed?.b?.context).toBe(16384);
    expect(seed?.b?.users).toBe(7);
    expect(seed?.b?.targetToks).toBe(22);
    expect(seed?.b?.profile).toBe('code');
    expect(seed?.ignored).toBe(false);

    // Общий q из ссылки режима B не должен давать ложное предупреждение
    // из-за несовместимости с формой A (у неё другой движок по умолчанию).
    const merged = mergeSeed(catalog, seed);
    expect(merged.mode).toBe('b');
    expect(merged.b.modelId).toBe('llama-3.1-8b');
    expect(merged.ignored).toBe(false);
  });

  it('13. Невалидный ?gpu=unknown игнорируется, выставляется флаг уведомления', () => {
    const seed = withWindow(
      '?mode=a&gpu=unknown&n=99&ctx=abc&u=5&q=q4_k_m&e=llama_cpp&foo=bar',
      () => readSeed(),
    );
    expect(seed?.ignored).toBe(true);
    expect(seed?.fromQuery).toBe(true);
    expect(seed?.mode).toBe('a');
    expect(seed?.a?.gpuId).toBe('unknown');
    expect(seed?.a?.users).toBe(5);

    const merged = mergeSeed(catalog, seed);
    expect(merged.ignored).toBe(true);
    expect(merged.a.gpuId).toBe('');
    expect(merged.a.users).toBe(5);
    expect(merged.a.gpuCount).toBe(1);
    expect(merged.a.context).toBe(8192);
    expect(merged.a.engineId).toBe('llama_cpp');
    expect(merged.a.quantId).toBe('q4_k_m');
  });
});
