// src/app/[lang]/page.tsx
import * as React from 'react';
import SearchHero from '@/components/SearchHero';
import HomeFeatures from '@/components/HomeFeatures';

type Lang = 'en' | 'ru';

export default function Page({ params: { lang } }: { params: { lang: Lang } }) {
  return (
    <main data-page="home" className="container-prose py-8 flex-1">
      <section className="container-prose pb-8 md:pb-10">
        <SearchHero lang={lang} />
      </section>

      {/* ЕДИНСТВЕННАЯ секция с id="home-features" */}
      <section id="home-features" className="container-prose" data-marker="page">
        <HomeFeatures lang={lang} />
      </section>
    </main>
  );
}
