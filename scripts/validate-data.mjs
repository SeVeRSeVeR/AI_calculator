import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = resolve(import.meta.dirname, '..');
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const pairs = [
  ['gpus', 15],
  ['models', 25],
  ['quantizations', 10],
  ['engines', 4],
  ['cpus', 10],
];

const data = {};
for (const [name, min] of pairs) {
  const schema = JSON.parse(await readFile(resolve(root, 'schemas', `${name}.schema.json`), 'utf8'));
  const payload = JSON.parse(await readFile(resolve(root, 'data', `${name}.json`), 'utf8'));
  data[name] = payload;
  const validate = ajv.compile(schema);
  if (!validate(payload)) {
    console.error(`✗ ${name}.json не соответствует схеме:`);
    for (const error of validate.errors ?? []) console.error(' ', error.instancePath, error.message);
    process.exit(1);
  }
  const list = payload[name];
  if (list.length < min) {
    console.error(`✗ ${name}.json: ${list.length} записей, требуется минимум ${min}`);
    process.exit(1);
  }
  console.log(`✓ ${name}.json: ${list.length} записей, схема OK`);
}

function uniqueIds(list, label) {
  const ids = new Set();
  for (const item of list) {
    if (ids.has(item.id)) {
      console.error(`✗ ${label}: дублирующийся id ${item.id}`);
      process.exit(1);
    }
    ids.add(item.id);
  }
}

uniqueIds(data.gpus.gpus, 'gpus');
uniqueIds(data.models.models, 'models');
uniqueIds(data.quantizations.quantizations, 'quantizations');
uniqueIds(data.engines.engines, 'engines');
uniqueIds(data.cpus.cpus, 'cpus');

const modelIds = new Set(data.models.models.map((model) => model.id));
for (const model of data.models.models) {
  if (model.is_draft) {
    const targets = model.dspark_target_models ?? [];
    if (targets.length === 0) {
      console.error(`model ${model.id}: draft model without dspark_target_models`);
      process.exit(1);
    }
    for (const target of targets) {
      if (!modelIds.has(target)) {
        console.error(`model ${model.id}: unknown dspark target ${target}`);
        process.exit(1);
      }
    }
  }
}
for (const engine of data.engines.engines) {
  if (typeof engine.supports_dspark !== 'boolean') {
    console.error(`engine ${engine.id}: supports_dspark must be boolean`);
    process.exit(1);
  }
}

for (const model of data.models.models) {
  if (model.params_active_b > model.params_total_b) {
    console.error(`✗ ${model.id}: params_active_b > params_total_b`);
    process.exit(1);
  }
  if (model.head_dim < 16) {
    console.error(`✗ ${model.id}: подозрительный head_dim=${model.head_dim}`);
    process.exit(1);
  }
}
if (!data.models.models.some((model) => model.moe)) {
  console.error('✗ В каталоге нет MoE-моделей');
  process.exit(1);
}
if (!data.models.models.some((model) => model.max_context >= 1000000)) {
  console.error('✗ В каталоге нет моделей с контекстом >= 1M');
  process.exit(1);
}
for (const engine of data.engines.engines) {
  if (engine.default_util_target < 0.5 || engine.default_util_target > 1) {
    console.error(`✗ ${engine.id}: default_util_target вне диапазона`);
    process.exit(1);
  }
}
for (const gpu of data.gpus.gpus) {
  if (gpu.bandwidth_source !== 'official' && !gpu.notes) {
    console.error(`✗ ${gpu.id}: неофициальный bandwidth без пометки в notes`);
    process.exit(1);
  }
}
console.log('✓ Перекрёстные проверки каталога пройдены');
