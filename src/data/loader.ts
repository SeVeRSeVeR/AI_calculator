import type { Catalog, Cpu, Engine, Gpu, Model, Quantization } from './types';

const DATA_VERSION = 'v1';
const FILES = {
  gpus: `data/gpus.${DATA_VERSION}.json`,
  models: `data/models.${DATA_VERSION}.json`,
  quantizations: `data/quantizations.${DATA_VERSION}.json`,
  engines: `data/engines.${DATA_VERSION}.json`,
  cpus: `data/cpus.${DATA_VERSION}.json`,
} as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateGpu(value: unknown, index: number): Gpu {
  assert(isRecord(value), `gpus[${index}] не объект`);
  assert(typeof value.id === 'string', `gpus[${index}].id отсутствует`);
  assert(typeof value.name === 'string', `gpus[${index}].name отсутствует`);
  assert(typeof value.vram_gb === 'number' && value.vram_gb > 0, `gpus[${index}].vram_gb некорректен`);
  assert(typeof value.bandwidth_gbs === 'number' && value.bandwidth_gbs > 0, `gpus[${index}].bandwidth_gbs некорректен`);
  assert(value.class === 'consumer' || value.class === 'prosumer' || value.class === 'datacenter', `gpus[${index}].class некорректен`);
  return value as unknown as Gpu;
}

function validateModel(value: unknown, index: number): Model {
  assert(isRecord(value), `models[${index}] не объект`);
  assert(typeof value.id === 'string', `models[${index}].id отсутствует`);
  assert(typeof value.params_total_b === 'number' && value.params_total_b > 0, `models[${index}].params_total_b некорректен`);
  assert(typeof value.params_active_b === 'number' && value.params_active_b > 0, `models[${index}].params_active_b некорректен`);
  assert(typeof value.n_layers === 'number' && value.n_layers > 0, `models[${index}].n_layers некорректен`);
  assert(typeof value.n_kv_heads === 'number' && value.n_kv_heads > 0, `models[${index}].n_kv_heads некорректен`);
  assert(typeof value.head_dim === 'number' && value.head_dim >= 16, `models[${index}].head_dim некорректен`);
  assert(typeof value.max_context === 'number' && value.max_context >= 512, `models[${index}].max_context некорректен`);
  if (value.is_draft !== undefined) assert(typeof value.is_draft === 'boolean', `models[${index}].is_draft некорректен`);
  if (value.dspark_target_models !== undefined) {
    assert(Array.isArray(value.dspark_target_models) && value.dspark_target_models.every((item) => typeof item === 'string'), `models[${index}].dspark_target_models некорректен`);
  }
  return value as unknown as Model;
}

function validateQuant(value: unknown, index: number): Quantization {
  assert(isRecord(value), `quantizations[${index}] не объект`);
  assert(typeof value.id === 'string', `quantizations[${index}].id отсутствует`);
  assert(typeof value.bytes_per_param === 'number' && value.bytes_per_param > 0, `quantizations[${index}].bytes_per_param некорректен`);
  assert(value.family === 'gpu' || value.family === 'gguf', `quantizations[${index}].family некорректен`);
  return value as unknown as Quantization;
}

function validateEngine(value: unknown, index: number): Engine {
  assert(isRecord(value), `engines[${index}] не объект`);
  assert(typeof value.id === 'string', `engines[${index}].id отсутствует`);
  assert(typeof value.default_util_target === 'number', `engines[${index}].default_util_target некорректен`);
  assert(typeof value.overhead_gb === 'number', `engines[${index}].overhead_gb некорректен`);
  assert(typeof value.supports_dspark === 'boolean', `engines[${index}].supports_dspark некорректен`);
  return value as unknown as Engine;
}

function validateCpu(value: unknown, index: number): Cpu {
  assert(isRecord(value), `cpus[${index}] не объект`);
  assert(typeof value.id === 'string', `cpus[${index}].id отсутствует`);
  assert(typeof value.cores === 'number' && value.cores > 0, `cpus[${index}].cores некорректен`);
  assert(typeof value.pcie_lanes === 'number', `cpus[${index}].pcie_lanes некорректен`);
  return value as unknown as Cpu;
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function loadCatalog(): Promise<Catalog> {
  const [gpusRaw, modelsRaw, quantizationsRaw, enginesRaw, cpusRaw] = await Promise.all([
    fetchJson(FILES.gpus),
    fetchJson(FILES.models),
    fetchJson(FILES.quantizations),
    fetchJson(FILES.engines),
    fetchJson(FILES.cpus),
  ]);

  assert(isRecord(gpusRaw) && Array.isArray(gpusRaw.gpus), 'Каталог GPU повреждён');
  assert(isRecord(modelsRaw) && Array.isArray(modelsRaw.models), 'Каталог моделей повреждён');
  assert(isRecord(quantizationsRaw) && Array.isArray(quantizationsRaw.quantizations), 'Каталог квантизаций повреждён');
  assert(isRecord(enginesRaw) && Array.isArray(enginesRaw.engines), 'Каталог движков повреждён');
  assert(isRecord(cpusRaw) && Array.isArray(cpusRaw.cpus), 'Каталог CPU повреждён');

  const gpus = gpusRaw.gpus.map(validateGpu);
  const models = modelsRaw.models.map(validateModel);
  const quantizations = quantizationsRaw.quantizations.map(validateQuant);
  const engines = enginesRaw.engines.map(validateEngine);
  const cpus = cpusRaw.cpus.map(validateCpu);

  assert(gpus.length >= 1 && models.length >= 1 && quantizations.length >= 1 && engines.length >= 1 && cpus.length >= 1, 'Каталог пуст');

  const ids = new Set(gpus.map((gpu) => gpu.id));
  assert(ids.size === gpus.length, 'Дублирующиеся id GPU');

  return {
    gpus,
    models,
    quantizations,
    engines,
    cpus,
    catalogVersion: String(modelsRaw.catalog_version ?? gpusRaw.catalog_version ?? 'unknown'),
    collectedAt: String(modelsRaw.collected_at ?? gpusRaw.collected_at ?? 'unknown'),
  };
}

export function quantizationsForEngine(catalog: Catalog, engineId: string): Quantization[] {
  const engine = catalog.engines.find((item) => item.id === engineId);
  const family = engine?.quant_family ?? 'gpu';
  return catalog.quantizations.filter((quant) => quant.family === family);
}

export function defaultQuantForEngine(catalog: Catalog, engineId: string): Quantization {
  const family = catalog.engines.find((engine) => engine.id === engineId)?.quant_family ?? 'gpu';
  const preferred = family === 'gguf' ? 'q4_k_m' : 'awq_4bit';
  return (
    catalog.quantizations.find((quant) => quant.id === preferred && quant.family === family) ??
    catalog.quantizations.find((quant) => quant.family === family) ??
    catalog.quantizations[0]
  );
}

export function engineForQuant(catalog: Catalog, quantId: string): Engine {
  const quant = catalog.quantizations.find((item) => item.id === quantId) ?? catalog.quantizations[0];
  const engineId = quant.family === 'gguf' ? 'llama_cpp' : 'vllm';
  return catalog.engines.find((engine) => engine.id === engineId) ?? catalog.engines[0];
}
