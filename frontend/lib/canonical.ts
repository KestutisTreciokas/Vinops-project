import { type Lang, canonicalUrl, hreflangs } from "@/lib/seo";
import type { Metadata } from "next";

const ALLOW: Record<string, "s" | "n"> = {
  make: "s",
  model: "s",
  year_min: "n",
  year_max: "n",
  sort: "s",   // price_asc | price_desc | date_desc
  page: "n",
};

const SORT_WHITELIST = new Set(["price_asc","price_desc","date_desc"]);

export function canonicalizeCarsQuery(sp: URLSearchParams) {
  const out = new URLSearchParams();
  let unknown = false;

  for (const [k, v] of sp) {
    if (!(k in ALLOW)) { unknown = true; continue; }
    if (!v) continue;
    if (k === "sort" && !SORT_WHITELIST.has(v)) continue;
    if (k === "page") {
      const p = Math.max(1, Number.parseInt(v || "1", 10) || 1);
      if (p !== 1) out.set("page", String(p));
      continue;
    }
    if (ALLOW[k] === "n") {
      const n = Number.parseInt(v, 10);
      if (Number.isFinite(n)) out.set(k, String(n));
      continue;
    }
    out.set(k, v);
  }

  // Стабильный порядок ключей
  const ordered = new URLSearchParams();
  for (const key of Object.keys(ALLOW)) {
    const v = out.get(key);
    if (v != null) ordered.set(key, v);
  }

  const canonicalQuery = ordered.toString(); // '' если пусто
  const isComplex = unknown; // любые неизвестные параметры считаем «сложными»
  return { canonicalQuery, isComplex };
}

export function carsMetadata(lang: Lang, searchParams: Record<string, string | string[] | undefined>): Metadata {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (Array.isArray(v)) { for (const vi of v) sp.append(k, String(vi)); }
    else if (v != null) { sp.set(k, String(v)); }
  }
  const { canonicalQuery, isComplex } = canonicalizeCarsQuery(sp);
  const path = canonicalQuery ? `/${lang}/cars?${canonicalQuery}` : `/${lang}/cars`;

  const alt = {
    en: canonicalQuery ? `/en/cars?${canonicalQuery}` : `/en/cars`,
    ru: canonicalQuery ? `/ru/cars?${canonicalQuery}` : `/ru/cars`,
  } as const;

  return {
    title: "Catalog — vinops",
    description: "Search cars by make, model and year.",
    alternates: { canonical: canonicalUrl(path), languages: hreflangs(alt) },
    robots: { index: !isComplex, follow: true },
  };
}
