import { create } from 'zustand';
import type { Catalog, FitStatus, Model, Profile } from '../data/types';
import { evaluateCatalog, type ModelEvaluation } from '../calc/fit';
import { buildConfigurations, type ModeBResult } from '../calc/configs';
import { defaultQuantForEngine, loadCatalog, quantizationsForEngine } from '../data/loader';
import { ru } from '../i18n/ru';
import {
  DEFAULT_MODE_A,
  DEFAULT_MODE_B,
  type Mode,
  type ModeAForm,
  type ModeBForm,
} from './forms';
import { mergeSeed } from './seed';
import {
  clearStoredState,
  persistState,
  readSeed,
  shareUrl,
  type Seed,
} from './query';
import { validateModeA, validateModeB } from './validation';

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AppState {
  status: CatalogStatus;
  catalog: Catalog | null;
  error: string | null;
  mode: Mode;
  a: ModeAForm;
  b: ModeBForm;
  advanced: boolean;
  attempted: boolean;
  resultA: ModelEvaluation[] | null;
  resultB: ModeBResult | null;
  selectedModelId: string | null;
  notice: string | null;
  seed: Seed | null;
  hydrated: boolean;
  load: () => Promise<void>;
  setMode: (mode: Mode) => void;
  setA: (patch: Partial<ModeAForm>) => void;
  setB: (patch: Partial<ModeBForm>) => void;
  setAdvanced: (open: boolean) => void;
  setSelectedModel: (id: string | null) => void;
  calculate: () => void;
  resetAll: () => void;
  nudgeA: (kind: 'lowerQuant' | 'lessContext' | 'moreGpu') => void;
  applyBPatch: (patch: { context?: number; quantId?: string; modelId?: string }) => void;
  dismissNotice: () => void;
  getShareUrl: () => string;
}

const initialSeed = typeof window === 'undefined' ? null : readSeed();

export const useAppStore = create<AppState>((set, get) => ({
  status: 'idle',
  catalog: null,
  error: null,
  mode: initialSeed?.mode ?? 'a',
  a: { ...DEFAULT_MODE_A },
  b: { ...DEFAULT_MODE_B },
  advanced: false,
  attempted: false,
  resultA: null,
  resultB: null,
  selectedModelId: null,
  notice: null,
  seed: initialSeed,
  hydrated: false,

  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      const catalog = await loadCatalog();
      const merged = mergeSeed(catalog, get().seed);
      set({
        catalog,
        status: 'ready',
        ...merged,
        notice: merged.ignored ? ru.states.linkParamsIgnored : null,
        hydrated: true,
        attempted: get().seed?.fromQuery ?? false,
      });
      if (merged.mode === 'a') {
        const valid = validateModeA(merged.a, catalog).valid;
        if (valid) get().calculate();
      } else {
        const model = catalog.models.find((item) => item.id === merged.b.modelId);
        const valid = validateModeB(merged.b, catalog, model).valid;
        if (valid) get().calculate();
      }
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        hydrated: true,
      });
    }
  },

  setMode: (mode) => set({ mode, selectedModelId: null }),

  setA: (patch) => {
    const state = get();
    const next = { ...state.a, ...patch };
    if (patch.engineId && state.catalog && patch.engineId !== state.a.engineId) {
      const quant = defaultQuantForEngine(state.catalog, patch.engineId);
      const available = quantizationsForEngine(state.catalog, patch.engineId);
      next.quantId = available.some((item) => item.id === state.a.quantId)
        ? state.a.quantId
        : quant.id;
    }
    set({ a: next, resultA: null, selectedModelId: null });
  },

  setB: (patch) => set({ b: { ...get().b, ...patch }, resultB: null }),

  setAdvanced: (open) => set({ advanced: open }),

  setSelectedModel: (id) => set({ selectedModelId: id }),

  calculate: () => {
    const { a, b, catalog, mode } = get();
    if (!catalog) return;
    if (mode === 'a') {
      const validation = validateModeA(a, catalog);
      if (!validation.valid) {
        set({ attempted: true, resultA: null, selectedModelId: null });
        return;
      }
      const gpu = catalog.gpus.find((item) => item.id === a.gpuId);
      const quant = catalog.quantizations.find((item) => item.id === a.quantId);
      const engine = catalog.engines.find((item) => item.id === a.engineId);
      if (!gpu || !quant || !engine) return;
      const gpus = Array.from({ length: Number(a.gpuCount) }, () => gpu);
      const result = evaluateCatalog(catalog.models, {
        gpus,
        quant,
        engine,
        contextTokens: Number(a.context),
        users: Number(a.users),
        utilTarget: a.utilTarget === '' ? undefined : Number(a.utilTarget),
        profile: a.profile,
      });
      set({ attempted: true, resultA: result, selectedModelId: null, mode: 'a' });
      return;
    }

    const model = catalog.models.find((item) => item.id === b.modelId);
    const validation = validateModeB(b, catalog, model);
    if (!validation.valid || !model) {
      set({ attempted: true, resultB: null, mode: 'b' });
      return;
    }
    const quant = catalog.quantizations.find((item) => item.id === b.quantId);
    if (!quant) return;
    const result = buildConfigurations({
      catalog,
      model,
      quant,
      contextTokens: Number(b.context),
      users: Number(b.users),
      targetToks: Number(b.targetToks),
      profile: b.profile,
    });
    set({ attempted: true, resultB: result, mode: 'b' });
  },

  resetAll: () => {
    clearStoredState();
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      window.history.replaceState(null, '', url.toString());
    }
    set({
      mode: 'a',
      a: { ...DEFAULT_MODE_A },
      b: { ...DEFAULT_MODE_B },
      advanced: false,
      attempted: false,
      resultA: null,
      resultB: null,
      selectedModelId: null,
      notice: null,
      seed: null,
    });
  },

  nudgeA: (kind) => {
    const state = get();
    if (!state.catalog) return;
    if (kind === 'moreGpu') {
      state.setA({ gpuCount: Math.min(8, Number(state.a.gpuCount || 1) + 1) });
    } else if (kind === 'lessContext') {
      state.setA({ context: Math.max(512, Math.floor(Number(state.a.context || 8192) / 2)) });
    } else {
      const engine = state.catalog.engines.find((item) => item.id === state.a.engineId);
      const available = engine
        ? state.catalog.quantizations.filter((quant) => quant.family === engine.quant_family)
        : state.catalog.quantizations;
      const current = available.find((quant) => quant.id === state.a.quantId);
      const lower = available
        .filter((quant) => quant.bytes_per_param < (current?.bytes_per_param ?? 1))
        .sort((x, y) => y.bytes_per_param - x.bytes_per_param)[0];
      if (lower) {
        state.setA({ quantId: lower.id });
      } else {
        // ASSUMPTION: если в семействе движка нет более низкой квантизации, переключаемся на GGUF Q3_K_M + llama.cpp.
        const fallback = state.catalog.quantizations.find((quant) => quant.id === 'q3_k_m');
        if (fallback) {
          const llama = state.catalog.engines.find((item) => item.id === 'llama_cpp');
          state.setA({ quantId: fallback.id, engineId: llama?.id ?? state.a.engineId });
        }
      }
    }
    get().calculate();
  },

  applyBPatch: (patch) => {
    get().setB(patch);
    get().calculate();
  },

  dismissNotice: () => set({ notice: null }),

  getShareUrl: () => shareUrl(get().mode, get().a, get().b),
}));

if (typeof window !== 'undefined') {
  useAppStore.subscribe((state, previous) => {
    if (state.status !== 'ready') return;
    if (state.a !== previous.a || state.b !== previous.b || state.mode !== previous.mode) {
      persistState(state.mode, state.a, state.b);
    }
  });
}

export function selectedEvaluation(): ModelEvaluation | null {
  const state = useAppStore.getState();
  if (!state.resultA || !state.selectedModelId) return null;
  return state.resultA.find((item) => item.model.id === state.selectedModelId) ?? null;
}

export function countByStatus(result: ModelEvaluation[] | null, status: FitStatus): number {
  return result?.filter((item) => item.status === status).length ?? 0;
}

export function currentModel(catalog: Catalog | null, id: string): Model | undefined {
  return catalog?.models.find((model) => model.id === id);
}

export function profileLabel(profile: Profile): string {
  return { chat: 'Чат', rag: 'RAG', code: 'Код', batch: 'Batch' }[profile];
}
