import type { Catalog, Cpu, Engine, Gpu, Model, Quantization } from '../src/data/types';
import gpus from '../data/gpus.json';
import models from '../data/models.json';
import quantizations from '../data/quantizations.json';
import engines from '../data/engines.json';
import cpus from '../data/cpus.json';

export const catalog: Catalog = {
  gpus: gpus.gpus as unknown as Gpu[],
  models: models.models as unknown as Model[],
  quantizations: quantizations.quantizations as unknown as Quantization[],
  engines: engines.engines as unknown as Engine[],
  cpus: cpus.cpus as unknown as Cpu[],
  catalogVersion: gpus.catalog_version,
  collectedAt: gpus.collected_at,
};

export function gpu(id: string): Gpu {
  const found = catalog.gpus.find((item) => item.id === id);
  if (!found) throw new Error(`GPU ${id} not found`);
  return found;
}

export function model(id: string): Model {
  const found = catalog.models.find((item) => item.id === id);
  if (!found) throw new Error(`Model ${id} not found`);
  return found;
}

export function quant(id: string): Quantization {
  const found = catalog.quantizations.find((item) => item.id === id);
  if (!found) throw new Error(`Quant ${id} not found`);
  return found;
}

export function engine(id: string): Engine {
  const found = catalog.engines.find((item) => item.id === id);
  if (!found) throw new Error(`Engine ${id} not found`);
  return found;
}

export function gpuList(id: string, count: number): Gpu[] {
  return Array.from({ length: count }, () => gpu(id));
}
