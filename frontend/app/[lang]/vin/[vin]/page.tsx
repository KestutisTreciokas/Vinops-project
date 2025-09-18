import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { type Lang, isValidVin, canonicalUrl, hreflangs } from "@/lib/seo";

type Props = { params: { lang: Lang; vin: string } };

function isTestVin(vin: string) {
  const list = (process.env.TEST_VINS ?? "")
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return list.includes(vin.toUpperCase());
}

// TODO: заменить на реальный фетч, когда появятся данные
async function hasRealData(_vin: string): Promise<boolean> {
  return false;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, vin } = params;
  const upperVin = vin.toUpperCase();

  if (!isValidVin(upperVin)) {
    // некорректный VIN — пусть страница 404 не индексируется
    return { robots: { index: false, follow: true } };
  }

  const path = `/${lang}/vin/${upperVin}`;
  const alt = {
    en: `/en/vin/${upperVin}`,
    ru: `/ru/vin/${upperVin}`,
  } as const;

  const hasData = await hasRealData(upperVin);
  const isTest = isTestVin(upperVin);

  // нет данных и VIN не тестовый — отдадим 404 (без индексации)
  if (!hasData && !isTest) {
    return {
      alternates: { canonical: canonicalUrl(path), languages: hreflangs(alt) },
      robots: { index: false, follow: true },
    };
  }

  const title = hasData
    ? `VIN ${upperVin} — vinops`
    : `VIN ${upperVin} (no data yet) — vinops`;
  const description = hasData
    ? "Auction history, photos, specs and sale results."
    : "We don't have data for this VIN yet. This page is not indexed.";

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(path), languages: hreflangs(alt) },
    robots: { index: hasData, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl(path),
      siteName: "vinops",
      type: "website",
    },
  };
}

export default async function VinPage({ params }: Props) {
  const upperVin = params.vin.toUpperCase();

  if (!isValidVin(upperVin)) {
    notFound();
  }

  const hasData = await hasRealData(upperVin);
  const isTest = isTestVin(upperVin);

  if (!hasData && !isTest) {
    notFound();
  }

  return (
    <main className="container-prose py-8">
      <h1 className="h1 mb-4">VIN {upperVin}</h1>
      <p className="text-fg-muted">
        {hasData
          ? "Data available (placeholder)"
          : "No data yet — placeholder (robots: noindex)."}
      </p>

      <section className="mt-10 text-sm">
        <h2 className="font-semibold mb-2">Removal request</h2>
        <p>
          Email:{" "}
          <a href="mailto:request@vinops.online">request@vinops.online</a> •{" "}
          Telegram:{" "}
          <a href="https://t.me/keustis" target="_blank" rel="noreferrer">
            @keustis
          </a>
        </p>
        <p>Include VIN, reason and proof. SLA: up to 10 minutes (410 + CDN purge).</p>
      </section>
    </main>
  );
}
