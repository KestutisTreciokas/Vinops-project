export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://vinops.online";
export const SUPPORTED_LANGS = ["en","ru"] as const;
export type Lang = typeof SUPPORTED_LANGS[number];

export function isValidVin(vin: string): boolean {
  // 17 chars, A–Z (no I,O,Q), 0–9
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());
}

export function canonicalUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export function hreflangs(pathByLang: Record<Lang,string>) {
  // Next.js metadata alternates.hreflang shape
  const entries = Object.entries(pathByLang) as [Lang,string][];
  const map: Record<string,string> = {};
  for (const [lang, path] of entries) {
    map[lang] = canonicalUrl(path);
  }
  map["x-default"] = canonicalUrl(pathByLang.en);
  return map;
}
