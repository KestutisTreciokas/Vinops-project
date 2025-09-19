// /root/work/vinops.restore/frontend/src/app/[lang]/ClientHome.tsx
import SearchHero from '@/components/SearchHero'
import HomeFeatures from '@/components/HomeFeatures'

export default function ClientHome({ lang }: { lang: 'en' | 'ru' }) {
  return (
    <>
      <section className="container-prose pb-8 md:pb-10">
        <SearchHero lang={lang} />
      </section>
      <section id="home-features" className="container-prose">
        <HomeFeatures lang={lang} />
      </section>
    </>
  )
}
