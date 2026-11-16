export type GpuClass = 'consumer' | 'prosumer' | 'datacenter';
export type Interconnect = 'pcie' | 'nvlink' | 'infinity_fabric' | 'unified';
export type BandwidthSource = 'official' | 'third_party' | 'computed';

export interface Gpu {
  id: string;
  vendor: string;
  name: string;
  vram_gb: number;
  bandwidth_gbs: number;
  tdp_w: number;
  nvlink: boolean;
  interconnect?: Interconnect;
  slots: number;
  pcie_lanes: number;
  fp8_tensor_cores: boolean;
  class: GpuClass;
  release_year: number;
  unified_memory: boolean;
  rocm_support: boolean;
  xpu_support?: boolean;
  bandwidth_source: BandwidthSource;
  price_usd?: number | null;
  notes?: string;
}

export interface Model {
  id: string;
  name: string;
  vendor: string;
  family: string;
  moe: boolean;
  params_total_b: number;
  params_active_b: number;
  n_layers: number;
  n_kv_heads: number;
  head_dim: number;
  max_context: number;
  license: string;
  commercial_ok: boolean;
  status: 'released' | 'announced';
  release_year: number;
  geometry_source: string;
  notes?: string;
}

export interface Quantization {
  id: string;
  name: string;
  family: 'gpu' | 'gguf';
  bits: number;
  bytes_per_param: number;
  kv_bytes_per_elem: number;
  description: string;
}

export interface Engine {
  id: string;
  name: string;
  gpu_only: boolean;
  offload_supported: boolean;
  default_util_target: number;
  overhead_gb: number;
  supports_tp: boolean;
  kv_bytes_per_elem: number;
  quant_family: 'gpu' | 'gguf';
  notes: string;
}

export interface Cpu {
  id: string;
  vendor: string;
  name: string;
  cores: number;
  pcie_lanes: number;
  tdp_w: number;
  class: 'consumer' | 'hedt' | 'workstation' | 'server';
  price_usd: number;
}

export interface Catalog {
  gpus: Gpu[];
  models: Model[];
  quantizations: Quantization[];
  engines: Engine[];
  cpus: Cpu[];
  catalogVersion: string;
  collectedAt: string;
}

export type Profile = 'chat' | 'rag' | 'code' | 'batch';

export type FitStatus = 'FITS_FULL' | 'FITS_TIGHT' | 'FITS_WITH_RAM' | 'NO_FIT';

export type FitReason =
  | 'OK'
  | 'KV_POOL_EXHAUSTED'
  | 'PER_GPU_OVERFLOW'
  | 'OFFLOAD_TOO_LARGE'
  | 'OFFLOAD_UNSUPPORTED'
  | 'KV_DOES_NOT_FIT';

export interface SpeedEstimate {
  tokPerSeq: number;
  tokPerSeqMin: number;
  tokPerSeqMax: number;
  totalTokS: number;
  batchEfficiency: number;
  offloadPenalty: number;
  bwEffectiveGbs: number;
  efficiency: number;
  tpFactor: number;
}
