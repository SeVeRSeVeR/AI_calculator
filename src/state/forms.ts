import type { Profile } from '../data/types';

export type Mode = 'a' | 'b';

export interface ModeAForm {
  gpuId: string;
  gpuCount: number | '';
  context: number | '';
  users: number | '';
  profile: Profile;
  quantId: string;
  engineId: string;
  utilTarget: number | '';
  targetToks: number | '';
  useDSpark: boolean;
}

export interface ModeBForm {
  modelId: string;
  quantId: string;
  context: number | '';
  users: number | '';
  targetToks: number | '';
  profile: Profile;
  useDSpark: boolean;
}

export const DEFAULT_MODE_A: ModeAForm = {
  gpuId: '',
  gpuCount: 1,
  context: 8192,
  users: 1,
  profile: 'chat',
  quantId: 'awq_4bit',
  engineId: 'vllm',
  utilTarget: '',
  targetToks: '',
  useDSpark: false,
};

export const DEFAULT_MODE_B: ModeBForm = {
  modelId: '',
  quantId: 'q4_k_m',
  context: 8192,
  users: 1,
  targetToks: 15,
  profile: 'chat',
  useDSpark: false,
};

export const STORAGE_KEY = 'llmcalc.v1';
export const PROFILES: Profile[] = ['chat', 'rag', 'code', 'batch'];
