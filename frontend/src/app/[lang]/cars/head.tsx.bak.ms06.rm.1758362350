export default function Head({ params }: { params: { lang: 'en'|'ru' } }) {
  const BASE = 'https://vinops.online'
  const PATH = '/cars'
  const url  = `${BASE}/${params.lang}${PATH}`
  return (
    <>
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="en"        href={`${BASE}/en${PATH}`} />
      <link rel="alternate" hrefLang="ru"        href={`${BASE}/ru${PATH}`} />
      <link rel="alternate" hrefLang="x-default" href={`${BASE}/en${PATH}`} />
    </>
  )
}
