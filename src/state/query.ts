import type { Profile } from '../data/types';
import {
  DEFAULT_MODE_A,
  DEFAULT_MODE_B,
  PROFILES,
  STORAGE_KEY,
  type Mode,
  type ModeAForm,
  type ModeBForm,
} from './forms';

export interface Seed {
  mode?: Mode;
  a?: Partial<ModeAForm>;
  b?: Partial<ModeBForm>;
  fromQuery: boolean;
  ignored: boolean;
}

function parseInteger(raw: string | null, min: number, max: number): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  if (!/^-?\d+$/.test(raw.trim())) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return undefined;
  return value;
}

function parseFloatParam(raw: string | null, min: number, max: number): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}

const QUERY_KEYS = new Set([
  'mode', 'gpu', 'n', 'ctx', 'u', 'q', 'e', 'profile', 'util', 'target', 'model',
]);

export function readSeed(): Seed | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.size === 0) return readStoredSeed();

  const ignoredKeys: string[] = [];
  const a: Partial<ModeAForm> = {};
  const b: Partial<ModeBForm> = {};
  let ignored = false;

  for (const key of params.keys()) {
    if (!QUERY_KEYS.has(key)) {
      ignoredKeys.push(key);
      ignored = true;
    }
  }

  const modeRaw = params.get('mode');
  let mode: Mode | undefined;
  if (modeRaw === 'a' || modeRaw === 'b') mode = modeRaw;
  else if (modeRaw !== null) ignored = true;

  const gpu = params.get('gpu');
  if (gpu) a.gpuId = gpu;
  else if (gpu !== null) ignored = true;

  const model = params.get('model');
  if (model) b.modelId = model;
  else if (model !== null) ignored = true;

  const n = parseInteger(params.get('n'), 1, 8);
  if (n !== undefined) a.gpuCount = n;
  else if (params.has('n')) ignored = true;

  const ctx = parseInteger(params.get('ctx'), 1, 1_000_000);
  if (ctx !== undefined) {
    a.context = ctx;
    b.context = ctx;
  } else if (params.has('ctx')) ignored = true;

  const users = parseInteger(params.get('u'), 1, 10_000);
  if (users !== undefined) {
    a.users = users;
    b.users = users;
  } else if (params.has('u')) ignored = true;

  const target = parseInteger(params.get('target'), 1, 1_000);
  if (target !== undefined) {
    a.targetToks = target;
    b.targetToks = target;
  } else if (params.has('target')) ignored = true;

  const util = parseFloatParam(params.get('util'), 0.8, 0.95);
  if (util !== undefined) a.utilTarget = util;
  else if (params.has('util')) ignored = true;

  const quant = params.get('q');
  if (quant) {
    a.quantId = quant;
    b.quantId = quant;
  } else if (quant !== null) ignored = true;

  const engine = params.get('e');
  if (engine) a.engineId = engine;
  else if (engine !== null) ignored = true;

  const profile = params.get('profile');
  if (profile && PROFILES.includes(profile as Profile)) {
    a.profile = profile as Profile;
    b.profile = profile as Profile;
  } else if (profile !== null) ignored = true;

  if (!mode) {
    if (model || b.modelId) mode = 'b';
    else if (gpu || a.gpuId) mode = 'a';
  }

  if (ignoredKeys.length > 0) ignored = true;

  return { mode, a, b, fromQuery: true, ignored };
}

function readStoredSeed(): Seed | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      mode?: Mode;
      a?: Partial<ModeAForm>;
      b?: Partial<ModeBForm>;
    };
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      mode: parsed.mode === 'a' || parsed.mode === 'b' ? parsed.mode : undefined,
      a: sanitizeStoredA(parsed.a),
      b: sanitizeStoredB(parsed.b),
      fromQuery: false,
      ignored: false,
    };
  } catch {
    return null;
  }
}

function sanitizeStoredA(raw: Partial<ModeAForm> | undefined): Partial<ModeAForm> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<ModeAForm> = {};
  if (typeof raw.gpuId === 'string') out.gpuId = raw.gpuId;
  if (typeof raw.gpuCount === 'number') out.gpuCount = raw.gpuCount;
  if (typeof raw.context === 'number') out.context = raw.context;
  if (typeof raw.users === 'number') out.users = raw.users;
  if (typeof raw.targetToks === 'number') out.targetToks = raw.targetToks;
  if (typeof raw.utilTarget === 'number') out.utilTarget = raw.utilTarget;
  if (typeof raw.quantId === 'string') out.quantId = raw.quantId;
  if (typeof raw.engineId === 'string') out.engineId = raw.engineId;
  if (raw.profile && PROFILES.includes(raw.profile)) out.profile = raw.profile;
  return out;
}

function sanitizeStoredB(raw: Partial<ModeBForm> | undefined): Partial<ModeBForm> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<ModeBForm> = {};
  if (typeof raw.modelId === 'string') out.modelId = raw.modelId;
  if (typeof raw.context === 'number') out.context = raw.context;
  if (typeof raw.users === 'number') out.users = raw.users;
  if (typeof raw.targetToks === 'number') out.targetToks = raw.targetToks;
  if (typeof raw.quantId === 'string') out.quantId = raw.quantId;
  if (raw.profile && PROFILES.includes(raw.profile)) out.profile = raw.profile;
  return out;
}

export function buildShareParams(mode: Mode, a: ModeAForm, b: ModeBForm): URLSearchParams {
  const params = new URLSearchParams();
  params.set('mode', mode);
  if (mode === 'a') {
    if (a.gpuId) params.set('gpu', a.gpuId);
    if (a.gpuCount !== '') params.set('n', String(a.gpuCount));
    if (a.context !== '') params.set('ctx', String(a.context));
    if (a.users !== '') params.set('u', String(a.users));
    if (a.quantId) params.set('q', a.quantId);
    if (a.engineId) params.set('e', a.engineId);
    params.set('profile', a.profile);
    if (a.utilTarget !== '') params.set('util', String(a.utilTarget));
    if (a.targetToks !== '') params.set('target', String(a.targetToks));
  } else {
    if (b.modelId) params.set('model', b.modelId);
    if (b.quantId) params.set('q', b.quantId);
    if (b.context !== '') params.set('ctx', String(b.context));
    if (b.users !== '') params.set('u', String(b.users));
    if (b.targetToks !== '') params.set('target', String(b.targetToks));
    params.set('profile', b.profile);
  }
  return params;
}

export function shareUrl(mode: Mode, a: ModeAForm, b: ModeBForm): string {
  const url = new URL(window.location.href);
  url.search = buildShareParams(mode, a, b).toString();
  url.hash = '';
  return url.toString();
}

export function persistState(mode: Mode, a: ModeAForm, b: ModeBForm): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, a, b }));
  } catch {
    // localStorage может быть недоступен в приватном режиме — молча пропускаем.
  }
}

export function clearStoredState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function defaults(): { a: ModeAForm; b: ModeBForm } {
  return { a: { ...DEFAULT_MODE_A }, b: { ...DEFAULT_MODE_B } };
}
