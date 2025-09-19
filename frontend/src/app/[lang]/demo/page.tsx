// src/app/[lang]/demo/page.tsx
export const dynamic = 'force-static';

import ClientHome from '../ClientHome';

export default function DemoPage({
  params,
}: {
  params: { lang: 'en' | 'ru' };
}) {
  return <ClientHome lang={params.lang} />;
}
