import type { Catalog, Model } from '../data/types';
import { ru } from '../i18n/ru';
import type { ModeAForm, ModeBForm } from './forms';

export interface ValidationResult {
  errors: Partial<Record<string, string>>;
  warnings: Partial<Record<string, string>>;
  valid: boolean;
}

export function isBlank(value: number | ''): boolean {
  return value === '' || value === null || value === undefined || Number.isNaN(value);
}

export function isInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

export function validateCommonNumber(
  value: number | '',
  field: string,
  min: number,
  max: number,
  errors: Partial<Record<string, string>>,
): void {
  if (isBlank(value)) {
    errors[field] = ru.validation.required;
    return;
  }
  if (!isInteger(Number(value))) {
    errors[field] = ru.validation.integer;
    return;
  }
  const number = Number(value);
  if (number < min || number > max) errors[field] = ru.validation.required;
}

export function validateModeA(form: ModeAForm, catalog: Catalog): ValidationResult {
  const errors: Partial<Record<string, string>> = {};
  const warnings: Partial<Record<string, string>> = {};

  if (!form.gpuId) errors.gpuId = ru.validation.gpuRequired;
  else if (!catalog.gpus.some((gpu) => gpu.id === form.gpuId)) errors.gpuId = ru.validation.gpuRequired;

  if (isBlank(form.gpuCount)) errors.gpuCount = ru.validation.required;
  else if (!isInteger(Number(form.gpuCount)) || Number(form.gpuCount) < 1 || Number(form.gpuCount) > 8) {
    errors.gpuCount = ru.validation.gpuCount;
  }

  if (isBlank(form.context)) errors.context = ru.validation.required;
  else if (!isInteger(Number(form.context)) || Number(form.context) < 1 || Number(form.context) > 1_000_000) {
    errors.context = ru.validation.contextRange;
  } else if (Number(form.context) < 512) {
    warnings.context = ru.validation.contextSmall;
  }

  if (isBlank(form.users)) errors.users = ru.validation.required;
  else if (!isInteger(Number(form.users)) || Number(form.users) < 1 || Number(form.users) > 10_000) {
    errors.users = ru.validation.usersRange;
  } else if (Number(form.users) > 1_000) {
    warnings.users = ru.validation.usersLarge;
  }

  if (!isBlank(form.targetToks)) {
    if (!isInteger(Number(form.targetToks)) || Number(form.targetToks) < 1 || Number(form.targetToks) > 1_000) {
      errors.targetToks = ru.validation.targetRange;
    }
  }

  if (!isBlank(form.utilTarget)) {
    const util = Number(form.utilTarget);
    if (!Number.isFinite(util) || util < 0.8 || util > 0.95) errors.utilTarget = ru.validation.utilRange;
  }

  if (!catalog.quantizations.some((quant) => quant.id === form.quantId)) {
    errors.quantId = ru.validation.quantRequired;
  }
  if (!catalog.engines.some((engine) => engine.id === form.engineId)) {
    errors.engineId = ru.validation.engineRequired;
  }

  return { errors, warnings, valid: Object.keys(errors).length === 0 };
}

export function validateModeB(form: ModeBForm, catalog: Catalog, model: Model | undefined): ValidationResult {
  const errors: Partial<Record<string, string>> = {};
  const warnings: Partial<Record<string, string>> = {};

  if (!form.modelId) errors.modelId = ru.validation.modelRequired;
  else if (!model) errors.modelId = ru.validation.modelRequired;

  if (isBlank(form.context)) errors.context = ru.validation.required;
  else if (!isInteger(Number(form.context)) || Number(form.context) < 1 || Number(form.context) > 1_000_000) {
    errors.context = ru.validation.contextRange;
  } else if (model && Number(form.context) > model.max_context) {
    errors.context = ru.validation.contextOverMax(model.max_context);
  } else if (Number(form.context) < 512) {
    warnings.context = ru.validation.contextSmall;
  }

  if (isBlank(form.users)) errors.users = ru.validation.required;
  else if (!isInteger(Number(form.users)) || Number(form.users) < 1 || Number(form.users) > 10_000) {
    errors.users = ru.validation.usersRange;
  } else if (Number(form.users) > 1_000) {
    warnings.users = ru.validation.usersLarge;
  }

  if (isBlank(form.targetToks)) errors.targetToks = ru.validation.required;
  else if (!isInteger(Number(form.targetToks)) || Number(form.targetToks) < 1 || Number(form.targetToks) > 1_000) {
    errors.targetToks = ru.validation.targetRange;
  }

  if (!catalog.quantizations.some((quant) => quant.id === form.quantId)) {
    errors.quantId = ru.validation.quantRequired;
  }

  return { errors, warnings, valid: Object.keys(errors).length === 0 };
}
