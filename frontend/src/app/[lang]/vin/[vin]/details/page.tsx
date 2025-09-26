import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL || '';

function isVinValid(vin: string): boolean {
  const v = vin.toUpperCase();
  if (v.length < 11 || v.length > 17) return false;
  if (v.length === 17 && /[IOQ]/.test(v)) return false;
  return /^[A-HJ-NPR-Z0-9]+$/.test(v);
}

async function fetchVehicle(vin: string) {
  const r = await fetch(`${ORIGIN}/api/v1/vehicles/${vin}`, {
    // важное: не писать в fetch-cache → устранить EACCES
    cache: 'no-store',
    next: { revalidate: 0 }
  }).catch(() => null);

  if (!r) return { status: 500, data: null };
  let data: any = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

export default async function Page({ params }: { params: { lang: string; vin: string } }) {
  const { vin } = params;
  if (!isVinValid(vin)) notFound(); // 422 → SSR 404

  const { status, data } = await fetchVehicle(vin);
  if (status === 404 || !data?.vehicle) notFound(); // unknown → SSR 404

  const v = data.vehicle;
  const { make, model, year, trim } = v || {};
  const jsonLdVehicle: any = {
    '@context':'https://schema.org',
    '@type':'Vehicle',
    vehicleIdentificationNumber: vin,
  };
  if (make)  jsonLdVehicle.brand = { '@type':'Brand', name: String(make) };
  if (model) jsonLdVehicle.model = String(model);
  if (year)  jsonLdVehicle.productionDate = String(year);

  const jsonLdBreadcrumb = {
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement:[
      { '@type':'ListItem', position:1, name:'Home', item:'/' },
      { '@type':'ListItem', position:2, name:'Cars', item:`/${params.lang}/cars` },
      { '@type':'ListItem', position:3, name:`VIN ${vin}`, item:`/${params.lang}/vin/${vin}` }
    ]
  };

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="h1">{year ? `${year} ` : ''}{make} {model}{trim ? `, ${trim}` : ''}</h1>
        <span className="badge">VIN {vin}</span>
      </div>

      <section className="prose">
        {/* ...основной контент карточки... */}
      </section>

      {/* JSON-LD (только если есть бренд/модель/год) */}
      {(jsonLdVehicle.brand?.name || jsonLdVehicle.model || jsonLdVehicle.productionDate) && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdVehicle) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
        </>
      )}
    </main>
  );
}
