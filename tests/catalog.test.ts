import { describe, expect, it } from 'vitest';
import { DEFAULT_MODE_A } from '../src/state/forms';
import { validateModeA } from '../src/state/validation';
import { catalog } from './fixtures';

describe('каталог', () => {
  it('для всех MoE-моделей params_total_b > params_active_b', () => {
    const moeModels = catalog.models.filter((item) => item.moe);
    expect(moeModels.length).toBeGreaterThan(0);
    for (const item of moeModels) {
      expect(item.params_total_b, `${item.id}: total должно быть больше active`).toBeGreaterThan(
        item.params_active_b,
      );
    }
  });

  it('быстрые контексты, включая 1,05M, проходят валидацию режима A', () => {
    const base = { ...DEFAULT_MODE_A, gpuId: 'rtx4090' };
    for (const context of [4096, 8192, 32768, 131072, 1048576]) {
      expect(validateModeA({ ...base, context }, catalog).errors.context, `context=${context}`).toBeUndefined();
    }
  });

  it('все новые GPU имеют корректные флаги платформы', () => {
    for (const id of ['rtx_pro_5000_bw_48', 'rtx_pro_5000_bw_72', 'rtx_pro_6000_bw_ws', 'rtx_pro_6000_bw_maxq', 'rtx_5090', 'rtx_5080', 'rtx_5070_ti', 'rtx_5060_ti_16', 'amd_r9700_pro', 'intel_arc_pro_b70']) {
      const gpu = catalog.gpus.find((item) => item.id === id);
      expect(gpu, `GPU ${id}`).toBeTruthy();
      expect(gpu!.unified_memory).toBe(false);
      expect(gpu!.bandwidth_source).toBe('official');
    }
    expect(catalog.gpus.find((item) => item.id === 'amd_r9700_pro')!.rocm_support).toBe(true);
    expect(catalog.gpus.find((item) => item.id === 'intel_arc_pro_b70')!.xpu_support).toBe(true);
  });
});
