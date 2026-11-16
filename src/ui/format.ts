const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export function num(value: number, digits: 0 | 1 | 2 = 1): string {
  if (digits === 0) return nf0.format(value);
  return (digits === 2 ? nf2 : nf).format(value);
}

export function gb(value: number): string {
  if (value >= 1024) return `${num(value / 1024, 2)} ТБ`;
  return `${num(value, 1)} ГБ`;
}

export function nvme(value: number): string {
  if (value >= 1024) return `${num(value / 1024, value % 1024 === 0 ? 0 : 1)} ТБ`;
  return `${num(value, 0)} ГБ`;
}

export function tokens(value: number): string {
  if (value >= 1_000_000) return `${num(value / 1_000_000, 2)}M`;
  if (value >= 1000) return `${num(value / 1000, 1)}K`;
  return String(value);
}

export function pct(value: number): string {
  return `${num(value * 100, 1)}%`;
}

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `$${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)}`;
}

export function tps(value: number): string {
  if (value >= 100) return `${num(value, 0)}`;
  if (value >= 10) return `${num(value, 1)}`;
  return `${num(value, 2)}`;
}
