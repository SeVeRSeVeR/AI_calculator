# DATA_SOURCES

Источники и методика формирования каталога. Версия каталога: **2026.11**. Дата сбора: **2026-11-16**. Валюта цен: **USD**.

Каталог статичен и не обновляется автоматически. Перед использованием в реальном проекте проверяйте актуальность цен, доступности и характеристик.

## Методика

1. **GPU.** VRAM, пропускная способность памяти, TDP, интерконнект и форм-фактор — из официальных страниц продуктов и datasheet производителя. Для потребительских карт приоритет у спецификации NVIDIA/AMD; для датацентровых — у datasheet NVIDIA/AMD. Цены — ориентировочные розничные или уличные предложения на дату сбора (Newegg, Amazon, B&H, Micro Center, специализированные реселлеры). Цена не включает налоги, доставку, шасси и опцию NVLink.
2. **Модели.** `params_total_b`, `params_active_b`, `n_layers`, `n_kv_heads`, `head_dim`, `max_context` — из `config.json` репозитория модели на Hugging Face. Для MoE `params_active_b` — сумма активных экспертов на токен, а не среднее по всем экспертам. Для MLA-моделей используются эффективные `n_kv_heads`/`head_dim` (см. `ASSUMPTIONS.md`).
3. **Квантизации.** `bytes_per_param` — эффективные байты на параметр, включая служебные шкалы, группы и упаковку. Для GGUF — типичные значения из карточек квантования и практики llama.cpp, а не теоретическая битность.
4. **Движки.** `overhead_gb`, `default_util_target`, поддержка TP и offload — из документации движков и практики эксплуатации. Значения консервативные.
5. **CPU.** Ядра, линии PCIe, TDP и цена — из спецификаций Intel/AMD. Число линий указано для типичной платформы; фактическое зависит от чипсета, материнской платы и конфигурации PCIe-слотов.
6. **Цены.** Округлены до реалистичного ориентира. Не являются офертой. Для датацентровых ускорителей цена за карту может сильно отличаться от контрактной.

## GPU

| id | Модель | VRAM, ГБ | Bandwidth, ГБ/с | TDP, Вт | Интерконнект | Класс | Цена, USD | Источник |
| --- | --- | ---: | ---: | ---: | --- | --- | ---: | --- |
| rtx5090 | GeForce RTX 5090 | 32 | 1792 | 575 | PCIe 5.0 | consumer | 1999 | NVIDIA GeForce RTX 50 Series, официальная спецификация |
| rtx5080 | GeForce RTX 5080 | 16 | 960 | 360 | PCIe 5.0 | consumer | 999 | NVIDIA GeForce RTX 50 Series, официальная спецификация |
| rtx5070ti | GeForce RTX 5070 Ti | 16 | 896 | 300 | PCIe 5.0 | consumer | 749 | NVIDIA GeForce RTX 50 Series, официальная спецификация |
| rtx4090 | GeForce RTX 4090 | 24 | 1008 | 450 | PCIe 4.0 | consumer | 1599 | NVIDIA GeForce RTX 40 Series, официальная спецификация |
| rtx4080super | GeForce RTX 4080 SUPER | 16 | 736 | 320 | PCIe 4.0 | consumer | 999 | NVIDIA GeForce RTX 40 Series, официальная спецификация |
| rtx3090 | GeForce RTX 3090 | 24 | 936 | 350 | PCIe 4.0 | consumer | 1100 | NVIDIA GeForce RTX 30 Series, официальная спецификация |
| rtx3060 | GeForce RTX 3060 12GB | 12 | 360 | 170 | PCIe 4.0 | consumer | 280 | NVIDIA GeForce RTX 30 Series, официальная спецификация |
| rx7900xtx | Radeon RX 7900 XTX | 24 | 960 | 355 | PCIe 4.0 | consumer | 900 | AMD Radeon RX 7000 Series, официальная спецификация |
| rx9070xt | Radeon RX 9070 XT | 16 | 645 | 304 | PCIe 5.0 | consumer | 599 | AMD Radeon RX 9000 Series, официальная спецификация |
| rtx_pro_6000_blackwell | RTX PRO 6000 Blackwell | 96 | 1792 | 600 | PCIe 5.0 | prosumer | 8500 | NVIDIA RTX PRO 6000 Blackwell Workstation Edition, datasheet |
| rtx_a6000 | RTX A6000 | 48 | 768 | 300 | PCIe 4.0 | prosumer | 4500 | NVIDIA RTX A6000, datasheet |
| l40s | L40S | 48 | 864 | 350 | PCIe 4.0 | prosumer | 8000 | NVIDIA L40S, datasheet |
| h100_sxm | H100 SXM | 80 | 3350 | 700 | NVLink | datacenter | 25000 | NVIDIA H100 Tensor Core GPU, datasheet |
| h200_sxm | H200 SXM | 141 | 4800 | 700 | NVLink | datacenter | 32000 | NVIDIA H200 Tensor Core GPU, datasheet |
| b200_sxm | B200 SXM | 192 | 8000 | 1000 | NVLink | datacenter | 40000 | NVIDIA B200 Tensor Core GPU, datasheet |
| a100_sxm | A100 SXM 80GB | 80 | 2039 | 400 | NVLink | datacenter | 15000 | NVIDIA A100 Tensor Core GPU, datasheet |
| mi300x | Instinct MI300X | 192 | 5300 | 750 | Infinity Fabric | datacenter | 20000 | AMD Instinct MI300X, datasheet |
| mi325x | Instinct MI325X | 256 | 6000 | 1000 | Infinity Fabric | datacenter | 25000 | AMD Instinct MI325X, datasheet |
| dgx_spark | DGX Spark | 128 | 273 | 240 | Unified | prosumer | 3999 | NVIDIA DGX Spark, официальная спецификация |
| mac_studio_m3_ultra | Mac Studio M3 Ultra 96GB | 96 | 819 | 270 | Unified | prosumer | 7000 | Apple Mac Studio, техническая спецификация |
| rtx_pro_5000_bw_48 | RTX PRO 5000 Blackwell 48GB | 48 | 1344 | 300 | PCIe 5.0 | prosumer | 4000 | NVIDIA RTX PRO 5000 Blackwell, datasheet |
| rtx_pro_5000_bw_72 | RTX PRO 5000 Blackwell 72GB | 72 | 1344 | 300 | PCIe 5.0 | prosumer | — | NVIDIA RTX PRO 5000 Blackwell, datasheet |
| rtx_pro_6000_bw_ws | RTX PRO 6000 Blackwell Workstation | 96 | 1792 | 600 | PCIe 5.0 | datacenter | 8565 | NVIDIA RTX PRO 6000 Blackwell Workstation Edition, datasheet |
| rtx_pro_6000_bw_maxq | RTX PRO 6000 Blackwell Max-Q | 96 | 1792 | 300 | PCIe 5.0 | datacenter | 8565 | NVIDIA RTX PRO 6000 Blackwell Max-Q, datasheet |
| rtx_5090 | RTX 5090 | 32 | 1792 | 575 | PCIe 5.0 | consumer | 1999 | NVIDIA GeForce RTX 50 Series, официальная спецификация |
| rtx_5080 | RTX 5080 | 16 | 960 | 360 | PCIe 5.0 | consumer | 999 | NVIDIA GeForce RTX 50 Series, официальная спецификация |
| rtx_5070_ti | RTX 5070 Ti | 16 | 896 | 300 | PCIe 5.0 | consumer | 749 | NVIDIA GeForce RTX 50 Series, официальная спецификация |
| rtx_5060_ti_16 | RTX 5060 Ti 16GB | 16 | 448 | 180 | PCIe 5.0 | consumer | 429 | NVIDIA GeForce RTX 50 Series, официальная спецификация |
| amd_r9700_pro | AMD Radeon AI PRO R9700 | 32 | 640 | 300 | PCIe 5.0 | prosumer | 1299 | AMD Radeon AI PRO R9700, официальная страница продукта |
| intel_arc_pro_b70 | Intel Arc Pro B70 | 32 | 512 | 250 | PCIe 5.0 | prosumer | — | Intel Arc Pro B70, официальная страница продукта |

Примечания:

- Для RTX 5090 указана память GDDR7 и PCIe 5.0; NVLink отсутствует.
- Для consumer-карт `pcie_lanes = 16`, `slots = 2`; для датацентровых — форм-фактор SXM/OAM и NVLink.
- `bandwidth_source = "official"` у всех записей: использованы паспортные значения, а не измеренная пропускная способность.
- `rocm_support = true` для Radeon и Instinct; для NVIDIA — `false`.
- `xpu_support = true` для Intel Arc Pro B70 (oneAPI/XPU); для остальных карт поле отсутствует или `false`.
- У новых карт NVIDIA, AMD и Intel заполнены `unified_memory = false` и `bandwidth_source = "official"`.
- RTX 5060 Ti 16GB использует PCIe 5.0 x8 электрически; в каталоге указано 16 линий для совместимости с остальными consumer-картами.
- Цены RTX PRO 5000 72GB и Intel Arc Pro B70 не зафиксированы официально на дату сбора и оставлены `null`; для расчёта БП и памяти цена не используется.
- Цены на H100/H200/B200/A100/MI300X/MI325X — ориентир за карту на вторичном/контрактном рынке; реальные цены зависят от объёма поставки и партнёра.
- DGX Spark и Mac Studio M3 Ultra помечены `unified_memory = true`. Их «VRAM» — общий пул unified memory, а не отдельная видеопамять.

## Модели

| id | Модель | Total, B | Active, B | Слои | KV heads | head_dim | Max ctx | Источник config.json |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| llama-3.1-8b | Llama 3.1 8B Instruct | 8.03 | 8.03 | 32 | 8 | 128 | 131072 | meta-llama/Llama-3.1-8B-Instruct |
| llama-3.3-70b | Llama 3.3 70B Instruct | 70.6 | 70.6 | 80 | 8 | 128 | 131072 | meta-llama/Llama-3.3-70B-Instruct |
| llama-3.2-3b | Llama 3.2 3B Instruct | 3.21 | 3.21 | 28 | 8 | 128 | 131072 | meta-llama/Llama-3.2-3B-Instruct |
| llama-3.1-405b | Llama 3.1 405B Instruct | 405 | 405 | 126 | 8 | 128 | 131072 | meta-llama/Llama-3.1-405B-Instruct |
| qwen3-8b | Qwen3 8B | 8.2 | 8.2 | 36 | 8 | 128 | 40960 | Qwen/Qwen3-8B |
| qwen3-14b | Qwen3 14B | 14.8 | 14.8 | 40 | 8 | 128 | 40960 | Qwen/Qwen3-14B |
| qwen3-32b | Qwen3 32B | 32.8 | 32.8 | 64 | 8 | 128 | 40960 | Qwen/Qwen3-32B |
| qwen2.5-coder-32b | Qwen2.5 Coder 32B Instruct | 32.8 | 32.8 | 64 | 8 | 128 | 32768 | Qwen/Qwen2.5-Coder-32B-Instruct |
| qwen2.5-72b | Qwen2.5 72B Instruct | 72.7 | 72.7 | 80 | 8 | 128 | 32768 | Qwen/Qwen2.5-72B-Instruct |
| qwen3-30b-a3b | Qwen3 30B A3B | 30.5 | 3.3 | 48 | 4 | 128 | 40960 | Qwen/Qwen3-30B-A3B |
| qwen3-235b-a22b | Qwen3 235B A22B | 235 | 22 | 94 | 4 | 128 | 131072 | Qwen/Qwen3-235B-A22B |
| qwen3-next-80b-a3b | Qwen3-Next 80B A3B | 80 | 3 | 48 | 4 | 128 | 262144 | Qwen/Qwen3-Next-80B-A3B-Instruct |
| gemma-3-27b | Gemma 3 27B IT | 27.4 | 27.4 | 62 | 16 | 256 | 131072 | google/gemma-3-27b-it |
| gemma-3-12b | Gemma 3 12B IT | 12.2 | 12.2 | 48 | 8 | 256 | 131072 | google/gemma-3-12b-it |
| gemma-3-4b | Gemma 3 4B IT | 4.3 | 4.3 | 34 | 4 | 256 | 131072 | google/gemma-3-4b-it |
| gemma-2-9b | Gemma 2 9B IT | 9.2 | 9.2 | 42 | 8 | 256 | 8192 | google/gemma-2-9b-it |
| mistral-small-3.2-24b | Mistral Small 3.2 24B | 23.6 | 23.6 | 40 | 8 | 128 | 131072 | mistralai/Mistral-Small-3.2-24B-Instruct-2506 |
| mistral-nemo-12b | Mistral NeMo 12B | 12.2 | 12.2 | 40 | 8 | 128 | 128000 | mistralai/Mistral-Nemo-Instruct-2407 |
| phi-3-medium-14b | Phi-3 Medium 14B | 14 | 14 | 40 | 10 | 128 | 131072 | microsoft/Phi-3-medium-128k-instruct |
| mixtral-8x7b | Mixtral 8x7B Instruct | 46.7 | 12.9 | 32 | 8 | 128 | 32768 | mistralai/Mixtral-8x7B-Instruct-v0.1 |
| mixtral-8x22b | Mixtral 8x22B Instruct | 141 | 39 | 56 | 8 | 128 | 65536 | mistralai/Mixtral-8x22B-Instruct-v0.1 |
| deepseek-v3 | DeepSeek V3 | 671 | 37 | 61 | 1 | 576 | 131072 | deepseek-ai/DeepSeek-V3 |
| deepseek-v4-flash | DeepSeek V4 Flash | 284 | 13 | 64 | 1 | 576 | 1048576 | deepseek-ai/DeepSeek-V4-Flash |
| deepseek-v4-pro | DeepSeek V4 Pro | 1600 | 49 | 80 | 1 | 576 | 1048576 | deepseek-ai/DeepSeek-V4-Pro |
| llama-4-scout | Llama 4 Scout | 109 | 17 | 48 | 8 | 128 | 10485760 | meta-llama/Llama-4-Scout-17B-16E-Instruct |
| llama-4-maverick | Llama 4 Maverick | 400 | 17 | 48 | 8 | 128 | 1048576 | meta-llama/Llama-4-Maverick-17B-128E-Instruct |
| kimi-k2.6 | Kimi K2.6 | 1000 | 32 | 61 | 1 | 576 | 262144 | moonshotai/Kimi-K2.6 |
| glm-4.5-air | GLM-4.5 Air | 106 | 12 | 46 | 8 | 128 | 131072 | zai-org/GLM-4.5-Air |
| gpt-oss-120b | GPT-OSS 120B | 117 | 5.1 | 36 | 8 | 64 | 131072 | openai/gpt-oss-120b |
| gpt-oss-20b | GPT-OSS 20B | 21 | 3.6 | 24 | 8 | 64 | 131072 | openai/gpt-oss-20b |
| deepseek-r1-distill-qwen-32b | DeepSeek R1 Distill Qwen 32B | 32.8 | 32.8 | 64 | 8 | 128 | 131072 | deepseek-ai/DeepSeek-R1-Distill-Qwen-32B |
| yi-1.5-34b | Yi 1.5 34B | 34.4 | 34.4 | 60 | 8 | 128 | 32768 | 01-ai/Yi-1.5-34B |
| mimo_v2_6_pro | MiMo-V2.6-Pro | 1020 | 42 | 70 | 8 | 192 | 1048576 | XiaomiMiMo/MiMo-V2.6-Pro-RL (официальный Pro gated) |
| deepseek_v4_1_flash | DeepSeek V4.1 Flash | 552 | 16 | 40 | 1 | 512 | 1048576 | deepseek-ai/DeepSeek-V4.1-Flash |
| kimi_k3 | Kimi K3 | 2800 | 104 | 93 | 96 | 128 | 1048576 | moonshotai/Kimi-K3 |
| qwen3_8_2_4t_a95b | Qwen3.8 2.4T-A95B | 2400 | 95 | 92 | 4 | 256 | 262144 | Qwen/Qwen3.8-2.4T-A95B |
| glm_5_3 | GLM-5.3 | 744 | 40 | 78 | 64 | 192 | 1048576 | zai-org/GLM-5.3 |
| minimax_m3 | MiniMax M3 | 428 | 23 | 60 | 4 | 128 | 1048576 | MiniMaxAI/MiniMax-M3 |
| deepseek_v4_flash | DeepSeek V4-Flash | 284 | 13 | 43 | 1 | 512 | 1048576 | deepseek-ai/DeepSeek-V4-Flash |
| mistral_small_4_119b | Mistral Small 4 119B | 119 | 6.5 | 36 | 32 | 128 | 262144 | mistralai/Mistral-Small-4-119B-2603 |
| gpt_oss_120b | gpt-oss-120b | 120 | 5.1 | 36 | 8 | 64 | 131072 | openai/gpt-oss-120b |
| qwen3_6_35b_a3b | Qwen3.6-35B-A3B | 35 | 3 | 40 | 2 | 256 | 262144 | Qwen/Qwen3.6-35B-A3B |
| llama_4_maverick | Llama 4 Maverick | 400 | 17 | 48 | 8 | 128 | 131072 | meta-llama/Llama-4-Maverick-17B-128E-Instruct |
| qwen3_8_27b | Qwen3.8-27B | 27 | 27 | 64 | 4 | 256 | 262144 | Qwen/Qwen3.8-27B |
| gemma_4_31b | Gemma 4 31B | 31 | 31 | 60 | 16 | 256 | 262144 | google/gemma-4-31B-it |
| gemma_4_12b | Gemma 4 12B | 11.95 | 11.95 | 48 | 8 | 256 | 262144 | google/gemma-4-12B-it |
| ornith_1_5_122b | Ornith 1.5 122B | 122 | 122 | 48 | 2 | 256 | 262144 | ornith-ai/Ornith-1.5-122B |
| dspark-draft-qwen3-8b | DSpark Draft for Qwen3-8B | 0.5 | 0.5 | 36 | 8 | 128 | 40960 | DSpark (оценка) |
| dspark-draft-llama-3.1-8b | DSpark Draft for Llama 3.1 8B | 0.5 | 0.5 | 32 | 8 | 128 | 131072 | DSpark (оценка) |
| dspark-draft-deepseek-v4-flash | DSpark Draft for DeepSeek V4-Flash | 1 | 1 | 43 | 1 | 512 | 1048576 | DSpark (оценка) |
| dspark-draft-kimi-k3 | DSpark Draft for Kimi K3 | 1.5 | 1.5 | 93 | 96 | 128 | 1048576 | DSpark (оценка) |

Примечания:

- Для dense-моделей `params_active_b = params_total_b`.
- Для MoE активные параметры: Qwen3 30B A3B — 3.3B, Qwen3 235B A22B — 22B, Qwen3-Next 80B A3B — 3B, Mixtral 8x7B — 12.9B, Mixtral 8x22B — 39B, DeepSeek V3 — 37B, DeepSeek V4 Flash — 13B, DeepSeek V4 Pro — 49B, Llama 4 Scout — 17B, Llama 4 Maverick — 17B, Kimi K2.6 — 32B, GLM-4.5 Air — 12B, GPT-OSS 120B — 5.1B, GPT-OSS 20B — 3.6B. Значения могут отличаться от маркетинговых округлений; для расчёта важна согласованность с `config.json`.
- Для Gemma 2/3 используется `head_dim = 256`, для GPT-OSS — 64, для MLA-моделей — 576. Это не ошибка: `hidden_size / n_heads` дал бы другое значение.
- Llama 4 Scout заявлен с контекстом до 10M токенов; в каталоге указано 10 485 760. Для практического расчёта это означает очень большой KV-кеш и, как правило, `NO_FIT` без сжатия/кэширования.
- `deepseek-v4-flash`, `deepseek-v4-pro`, `kimi-k2.6` — записи на дату сбора; если репозиторий или `config.json` ещё не опубликован, использованы публичные анонсы и консервативные оценки. Проверяйте перед продакшеном.
- `max_context` — заявленное максимальное окно; реальная поддержка зависит от движка и версии модели.
- Лицензии новых моделей перенесены из задания и карточек Hugging Face: Kimi K3 (`commercial_ok = false`, отдельная лицензия при выручке > $20M), Qwen3.8 2.4T-A95B (`Qwen3.8-Max`, `false`), GLM-5.3 (`true`), MiniMax M3 (`MiniMax Community`, `false`), остальные MoE — MIT/Apache-2.0/Llama 4.
- `MiMo-V2.6-Pro`: официальный репозиторий модели gated (HTTP 401), геометрия взята из `XiaomiMiMo/MiMo-V2.6-Pro-RL` (70 слоёв, 8 KV-heads, head_dim 192).
- `Mistral Small 4 119B`: официальный идентификатор `mistralai/Mistral-Small-4-119B-2603`.
- `Llama 4 Maverick`: официальный `config.json` gated (HTTP 401); геометрия сверена с существующей записью `llama-4-maverick`.
- `Ornith 1.5 122B`: в `config.json` обнаружены 256 экспертов (top-8), то есть архитектурно это MoE. По заданию запись внесена как dense (`moe = false`, 122/122); расхождение зафиксировано в `notes`.
- `deepseek_v4_flash` и `gpt_oss_120b` дополняют существующие записи `deepseek-v4-flash` и `gpt-oss-120b` с другими значениями из задания; это осознанные отдельные записи каталога.
- `is_draft: true` помечает draft-модели DSpark. Они не участвуют в обычном подборе целевых моделей и используются только при включённом DSpark; `dspark_target_models` содержит id целевых моделей.

## Ссылки на первоисточники

Дата сбора: **2026-11-16**.

**NVIDIA**
- GeForce RTX 50 Series: <https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/>
- RTX PRO 5000 Blackwell: <https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-5000/>
- RTX PRO 6000 Blackwell: <https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/>
- RTX PRO 6000 Blackwell Max-Q: <https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/>

**AMD**
- Radeon AI PRO R9700: <https://www.amd.com/en/products/graphics/workstations/radeon-pro/ai-pro-r9700.html>
- ROCm documentation: <https://rocm.docs.amd.com/>

**Intel**
- Intel Arc Pro B70: <https://www.intel.com/content/www/us/en/products/sku/242861/intel-arc-pro-b70-graphics/specifications.html>
- oneAPI / XPU: <https://www.intel.com/content/www/us/en/developer/tools/oneapi/overview.html>

**Hugging Face (config.json)**
- <https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL>
- <https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash>
- <https://huggingface.co/moonshotai/Kimi-K3>
- <https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B>
- <https://huggingface.co/zai-org/GLM-5.3>
- <https://huggingface.co/MiniMaxAI/MiniMax-M3>
- <https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash>
- <https://huggingface.co/mistralai/Mistral-Small-4-119B-2603>
- <https://huggingface.co/openai/gpt-oss-120b>
- <https://huggingface.co/Qwen/Qwen3.6-35B-A3B>
- <https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct>
- <https://huggingface.co/Qwen/Qwen3.8-27B>
- <https://huggingface.co/google/gemma-4-31B-it>
- <https://huggingface.co/google/gemma-4-12B-it>
- <https://huggingface.co/ornith-ai/Ornith-1.5-122B>

## Квантизации

| id | Название | Семейство | Бит | Байт/параметр | KV байт/элемент | Комментарий |
| --- | --- | --- | ---: | ---: | ---: | --- |
| fp16 | FP16 | gpu | 16 | 2.0 | 2 | Полная точность, максимальная совместимость |
| bf16 | BF16 | gpu | 16 | 2.0 | 2 | Полная точность с широким динамическим диапазоном |
| fp8 | FP8 (E4M3) | gpu | 8 | 1.0 | 1 | Hopper/Ada/Blackwell; KV-кеш также можно держать в FP8 |
| int8 | INT8 | gpu | 8 | 1.0 | 1 | 8-битная весовая квантизация |
| awq_4bit | AWQ 4-bit | gpu | 4 | 0.55 | 2 | Activation-aware weight quantization, хорошо для vLLM/SGLang |
| gptq_4bit | GPTQ 4-bit | gpu | 4 | 0.55 | 2 | GPTQ, широкая поддержка в vLLM/TGI |
| q8_0 | GGUF Q8_0 | gguf | 8 | 1.06 | 2 | Почти без потерь, удобно для llama.cpp |
| q6_k | GGUF Q6_K | gguf | 6 | 0.82 | 2 | Компромисс качества и памяти |
| q5_k_m | GGUF Q5_K_M | gguf | 5 | 0.70 | 2 | Средняя квантизация |
| q4_k_m | GGUF Q4_K_M | gguf | 4 | 0.55 | 2 | Де-факто стандарт для локального инференса |
| q3_k_m | GGUF Q3_K_M | gguf | 3 | 0.43 | 2 | Агрессивная квантизация, заметная потеря качества |

Источники: документация llama.cpp (`quantize`, GGUF k-quants), карточки моделей GGUF на Hugging Face (например, `bartowski`, `TheBloke`), документация vLLM/AWQ/GPTQ, спецификация FP8 E4M3. Значения `bytes_per_param` — эффективные, проверены на типичных размерах файлов, а не только по формуле `bits / 8`.

## Движки

| id | Движок | GPU-only | Offload | util_target | Overhead, ГБ | TP | KV байт/элемент | DSpark | Семейство квантизации |
| --- | --- | --- | --- | ---: | ---: | --- | ---: | --- | --- |
| vllm | vLLM | да | нет | 0.90 | 1.5 | да | 2 | да | gpu |
| llama_cpp | llama.cpp | нет | да | 0.95 | 1.5 | нет (layer-split) | 2 | да | gguf |
| tgi | TGI | да | нет | 0.90 | 1.5 | да | 2 | нет | gpu |
| sglang | SGLang | да | нет | 0.90 | 1.5 | да | 2 | да | gpu |

Источники: документация vLLM (`gpu_memory_utilization`, PagedAttention), llama.cpp (`n_gpu_layers`, layer-split), Hugging Face TGI, SGLang (RadixAttention). `overhead_gb = 1.5` — консервативная оценка, а не параметр движка по умолчанию.

### DSpark

DSpark — спекулятивное декодирование DeepSeek с отдельной draft-моделью (EAGLE-style). В каталоге движков флаг `supports_dspark`: vLLM — да (PR #46995), llama.cpp — да (нативная поддержка с CUDA), TGI — нет, SGLang — да.

- Репозиторий: <https://github.com/deepseek-ai/DSpark>
- Коэффициенты ускорения взяты из открытых обзоров и бенчмарков: KDnuggets (<https://www.kdnuggets.com/>) и блог Liquid AI (<https://www.liquid.ai/blog>).
- В расчёте используются консервативные значения: **1.5×** для vLLM/SGLang и **1.3×** для llama.cpp. В открытых бенчмарках встречается до **1.85×** в зависимости от движка и размера батча.
- Draft-модели в `data/models.json` помечены `is_draft: true` и содержат `dspark_target_models` со списком целевых id. Их размеры (0.5–1.5B) — консервативная оценка, а не точные опубликованные параметры.
- Целевой id для Kimi K3 в каталоге — `kimi_k3` (именно он указан в `dspark_target_models` draft-модели), чтобы ссылка была согласована с записью каталога.

## CPU

| id | CPU | Ядра | Линии PCIe | TDP, Вт | Цена, USD | Источник |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| ryzen-9-9950x | Ryzen 9 9950X | 16 | 24 | 170 | 620 | AMD Ryzen 9000 Series, официальная спецификация |
| ryzen-9-7950x | Ryzen 9 7950X | 16 | 24 | 170 | 520 | AMD Ryzen 7000 Series, официальная спецификация |
| core-i9-14900k | Core i9-14900K | 24 | 20 | 253 | 550 | Intel Core 14th Gen, официальная спецификация |
| core-ultra-9-285k | Core Ultra 9 285K | 24 | 24 | 250 | 590 | Intel Core Ultra 200S, официальная спецификация |
| threadripper-7970x | Threadripper 7970X | 32 | 48 | 350 | 2500 | AMD Ryzen Threadripper 7000, официальная спецификация |
| threadripper-7980x | Threadripper 7980X | 64 | 48 | 350 | 5000 | AMD Ryzen Threadripper 7000, официальная спецификация |
| threadripper-pro-7995wx | Threadripper PRO 7995WX | 96 | 128 | 350 | 10000 | AMD Ryzen Threadripper PRO 7000 WX, официальная спецификация |
| xeon-w9-3495x | Xeon w9-3495X | 56 | 112 | 350 | 6000 | Intel Xeon W-3400, официальная спецификация |
| xeon-silver-4410y | Xeon Silver 4410Y | 12 | 80 | 150 | 600 | Intel Xeon Scalable 4th Gen, официальная спецификация |
| xeon-gold-6430 | Xeon Gold 6430 | 32 | 80 | 270 | 2200 | Intel Xeon Scalable 4th Gen, официальная спецификация |
| epyc-9354 | EPYC 9354 | 32 | 128 | 280 | 3000 | AMD EPYC 9004, официальная спецификация |
| epyc-9654 | EPYC 9654 | 96 | 128 | 360 | 9000 | AMD EPYC 9004, официальная спецификация |

Примечания:

- Число линий PCIe — максимум для платформы; фактически доступное количество зависит от материнской платы, чипсета и занятых слотов.
- TDP — паспортный, а не измеренный. Для расчёта БП используется паспортный TDP с запасом 1.3.
- Цены — ориентировочные розничные на дату сбора.
- Для серверных платформ (Xeon, EPYC) цена материнской платы, RAM и шасси не входит.

## Ограничения источников

- Официальные страницы производителей иногда меняют URL и снимают спецификации старых карт. Значения зафиксированы на дату сбора.
- Пропускная способность памяти — паспортная. Реальная эффективная пропускная способность ниже на 10–25% в зависимости от доступа; это частично учтено коэффициентами скорости.
- Цены на GPU в рознице и контрактах могут отличаться в разы. Для датацентровых карт ориентируйтесь на контракт, а не на таблицу.
- `config.json` для некоторых моделей использует поля `num_key_value_heads`, `head_dim`, `max_position_embeddings`; в каталог перенесены уже нормализованные значения. Для MLA-моделей поля могут называться иначе, поэтому использованы эффективные значения.
- Если модель отсутствует в каталоге, это не значит, что она не запустится. Каталог покрывает популярные семейства и не претендует на полноту.
- Данные о будущих моделях (DeepSeek V4, Kimi K2.6) могут быть неполными или основанными на анонсах. Перед использованием проверяйте официальный `config.json`.

## Как обновлять

1. Возьмите новое значение из первоисточника.
2. Обновите `data/*.json`.
3. Если изменилась структура — обновите `schemas/*.json` и при необходимости `DATA_VERSION`.
4. Обновите эту таблицу и дату `collected_at`.
5. Запустите `npm run validate:data`, `npm test`, `npm run build`, `npm run smoke`.
6. Если изменились допущения или коэффициенты, обновите `ASSUMPTIONS.md` и версию формул `CALC_VERSION`.
