// src/components/HomeFeatures.tsx
import * as React from 'react';

type Lang = 'en' | 'ru';

const T = {
  titleVin: {
    en: 'VIN lookup',
    ru: 'Проверка VIN',
  },
  descVin: {
    en: 'Open auction records and current status.',
    ru: 'Открытые записи аукционов и текущий статус.',
  },
  titleHistory: {
    en: 'Sales history',
    ru: 'История продаж',
  },
  descHistory: {
    en: 'Hammer prices and status changes over time.',
    ru: 'Финальные ставки и изменения статусов.',
  },
  titleSpecs: {
    en: 'Full specs',
    ru: 'Полные характеристики',
  },
  descSpecs: {
    en: 'Technical details compiled from listings.',
    ru: 'Технические характеристики из лотов.',
  },
  titlePrivacy: {
    en: 'Privacy control',
    ru: 'Контроль приватности',
  },
  descPrivacy: {
    en: 'Request removal of sensitive data.',
    ru: 'Запрос на удаление персональных данных.',
  },
} as const;

export default function HomeFeatures({ lang }: { lang: Lang }) {
  return (
    // ВНИМАНИЕ: здесь НЕТ <section id="home-features"> — только контент.
    <div className="grid gap-4 md:gap-6 lg:grid-cols-12">
      {/* VIN lookup */}
      <div className="lg:col-span-3">
        <div className="card p-4 md:p-5 ">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-10 w-10 rounded-xl bg-[color-mix(in_hsl,var(--brand)_12%,transparent)] text-[var(--brand)] flex items-center justify-center">
              {/* Magnifier */}
              <svg className="w-5 h-5" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M21 21l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-medium">{T.titleVin[lang]}</div>
              <div className="text-sm text-fg-muted mt-1">{T.descVin[lang]}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales history */}
      <div className="lg:col-span-3">
        <div className="card p-4 md:p-5 ">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-10 w-10 rounded-xl bg-[color-mix(in_hsl,var(--brand)_12%,transparent)] text-[var(--brand)] flex items-center justify-center">
              {/* Clock/History */}
              <svg className="w-5 h-5" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 13a8 8 0 1 0 2.34-5.66L4 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-medium">{T.titleHistory[lang]}</div>
              <div className="text-sm text-fg-muted mt-1">{T.descHistory[lang]}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Full specs */}
      <div className="lg:col-span-3">
        <div className="card p-4 md:p-5 ">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-10 w-10 rounded-xl bg-[color-mix(in_hsl,var(--brand)_12%,transparent)] text-[var(--brand)] flex items-center justify-center">
              {/* Document */}
              <svg className="w-5 h-5" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 3h6l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M8.5 12h7M8.5 15.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-medium">{T.titleSpecs[lang]}</div>
              <div className="text-sm text-fg-muted mt-1">{T.descSpecs[lang]}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy control */}
      <div className="lg:col-span-3">
        <div className="card p-4 md:p-5 ">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-10 w-10 rounded-xl bg-[color-mix(in_hsl,var(--brand)_12%,transparent)] text-[var(--brand)] flex items-center justify-center">
              {/* Shield + check */}
              <svg className="w-5 h-5" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 5 6v6c0 4.5 3.2 6.9 7 9 3.8-2.1 7-4.5 7-9V6l-7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-medium">{T.titlePrivacy[lang]}</div>
              <div className="text-sm text-fg-muted mt-1">{T.descPrivacy[lang]}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
