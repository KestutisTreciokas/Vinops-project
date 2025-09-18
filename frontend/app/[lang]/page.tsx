export const dynamic = 'force-dynamic';
export default function LangHome({ params }: { params: { lang: 'en'|'ru' } }) {
  const { lang } = params;
  return (
    <main style={{padding:'2rem', fontFamily:'system-ui, sans-serif'}}>
      <h1>VINOPS</h1>
      <p>{lang==='ru' ? 'Главная (заглушка)' : 'EN landing (stub)'}</p>
    </main>
  );
}
