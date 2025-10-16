export type Lang = 'ru' | 'en';

const l = (lang: Lang) => (lang === 'ru' ? 'ru-RU' : 'en-US');

export function formatUsd(v: number | null | undefined, lang: Lang = 'en') {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat(l(lang), {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatMiles(v: number | null | undefined, lang: Lang = 'en') {
  if (v == null || Number.isNaN(v)) return '—';
  const num = new Intl.NumberFormat(l(lang), { maximumFractionDigits: 0 }).format(v);
  return lang === 'ru' ? `${num} миль` : `${num} mi`;
}

export function formatDateISO(iso: string | null | undefined, lang: Lang = 'en') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '—';
  return new Intl.DateTimeFormat(l(lang), {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}
