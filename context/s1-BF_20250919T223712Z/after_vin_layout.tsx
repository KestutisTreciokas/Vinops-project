import type { Metadata } from 'next';

export const metadata: Metadata = {
  // SEO безопасно: по умолчанию заголовок от VIN-страницы останется VIN-ориентированным
  title: { default: 'vinops', template: '%s — vinops' },
};

export default function VinLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: 'en'|'ru'; vin?: string };
}) {
  const t = (en: string, ru: string) => (params.lang === 'ru' ? ru : en);
  const vin = (params as any)?.vin ?? '';

  return (
    <div data-page="vin">
      {/* S1-B header: placeholder под Year Make Model, Trim; VIN — в чипе справа */}
      <div className="container-prose py-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="h1 m-0 flex-1" data-vin-title="">
            {/* step 2 (позже): сюда подставим "Year Make Model, Trim" */}
          </h1>
          {vin && (
            <span className="chip chip--vin" aria-label="VIN">VIN: {vin}</span>
          )}
        </div>
      </div>

      {/* Основной контент страницы */}
      <div className="container-prose pb-6">
        {children}
      </div>
    </div>
  );
}
