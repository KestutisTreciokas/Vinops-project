import React from 'react';
type AnyRec = Record<string, any>;

export default function VinStructuredData({
  lang = 'en', vin = '', specs, lot, photos, history,
}: {
  lang?: string; vin?: string; specs?: AnyRec; lot?: AnyRec; photos?: AnyRec[]; history?: AnyRec[];
}) {
  const V = (vin || '').toUpperCase();
  const L = (lang || 'en').toLowerCase();
  if (!V) return null;

  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vinops.online').replace(/\/+$/, '');
  const url  = `${base}/${L}/vin/${V}`;

  const json = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Vehicle',
      name: `VIN ${V}`,
      url,
      vehicleIdentificationNumber: V
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/${L}` },
        { '@type': 'ListItem', position: 2, name: `VIN ${V}`, item: url }
      ]
    }
  ]);

  return (
    <script id="ld-vehicle" type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }} />
  );
}
