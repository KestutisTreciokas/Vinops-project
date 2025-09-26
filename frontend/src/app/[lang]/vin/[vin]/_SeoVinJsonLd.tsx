'use client';
// Исторический компонент для JSON-LD на VIN-странице.
// Делает НИЧЕГО, если нет валидных данных; пустой <script id="ld-vehicle"> не рендерим.
import React from 'react';
type LD = Record<string, any>;
export default function SeoVinJsonLd({ vehicle, breadcrumb }: { vehicle?: LD, breadcrumb?: LD }) {
  const blocks: LD[] = [];
  if (vehicle && (vehicle.brand?.name || vehicle.model || vehicle.productionDate)) {
    blocks.push(vehicle);
  }
  if (breadcrumb && Array.isArray(breadcrumb.itemListElement) && breadcrumb.itemListElement.length > 0) {
    blocks.push(breadcrumb);
  }
  if (blocks.length === 0) return null;
  return (
    <script type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(blocks) }} />
  );
}
