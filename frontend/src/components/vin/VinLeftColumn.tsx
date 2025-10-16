import VinGallery from './VinGallery'
import VinSpecs from './VinSpecs'
import VinLot from './VinLot'
import VinHistory from './VinHistory'

export default function VinLeftColumn() {
  // дефолт для тайпчека старых компонентов
  const lang: 'ru' | 'en' = 'en'
  return (
    <div className="lg:col-span-8 space-y-6">
      <VinGallery images={[]} />
      <VinSpecs items={[]} />
      <VinLot lang={lang} />
      <VinHistory lang={lang} />
    </div>
  )
}
