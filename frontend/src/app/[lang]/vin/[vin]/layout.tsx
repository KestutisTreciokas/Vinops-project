import React from 'react';

export default function VinLayout({ children }: { children: React.ReactNode }) {
  // Вся SEO-логика (title/robots/canonical/hreflang/JSON-LD) — в page.tsx
  return <>{children}</>;
}
