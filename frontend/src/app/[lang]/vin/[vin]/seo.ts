import type { Metadata } from 'next'

type Lang = 'en' | 'ru'

/** --- buildVinMeta: поддерживаем оба варианта вызова --- */
export function buildVinMeta(args: { lang: Lang; vin: string }): Metadata
export function buildVinMeta(lang: Lang, vin: string): Metadata
export function buildVinMeta(a: any, b?: any): Metadata {
  // no-op: ничего не переопределяем на уровне layout
  return {}
}

/** --- buildVehicleJsonLd: поддерживаем оба варианта вызова --- */
export function buildVehicleJsonLd(args: { lang: Lang; vin: string }): string
export function buildVehicleJsonLd(lang: Lang, vin: string): string
export function buildVehicleJsonLd(a: any, b?: any): string {
  // no-op: ничего не выводим из layout
  return ''
}

/** Доп. заглушки на всякий случай */
export const metadata: Metadata = {}
export const seo: Metadata = {}
export const VIN_SEO: Metadata = {}
export function buildVinSeo(): Metadata { return {} }
export default {}
