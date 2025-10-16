import type { ComponentProps } from 'react'
import Features from './Features'

type Props = ComponentProps<typeof Features>

export default function FeaturesSSR(props: Props) {
  // Важно: без собственного <section> — секция features уже рендерится внутри <Features />
  return <Features {...props} />
}
