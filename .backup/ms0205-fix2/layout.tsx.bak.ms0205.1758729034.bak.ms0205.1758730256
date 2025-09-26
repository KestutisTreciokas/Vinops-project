import type { Metadata } from 'next'
import React from 'react'
import { buildVinMeta, buildVehicleJsonLd } from './seo'

export async function generateMetadata(
  { params }: { params: { lang: 'en'|'ru', vin: string } }
): Promise<Metadata> {
  const { lang, vin } = params
  return buildVinMeta(lang, vin)
}

export default function VinLayout({
  children, params
}: {
  children: React.ReactNode,
  params: { lang: 'en'|'ru', vin: string }
}) {
  const { lang, vin } = params
  const ld = buildVehicleJsonLd(lang, vin)
  return (
    <>
      {children}
      <script id="ld-vehicle" type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: ld }} />
    </>
  )
}
