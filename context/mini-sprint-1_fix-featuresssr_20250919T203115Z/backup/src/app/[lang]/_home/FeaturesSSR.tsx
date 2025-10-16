import type { ComponentProps } from 'react';
import Features from './Features';

type Props = ComponentProps<typeof Features>;

export default function FeaturesSSR(props: Props) {
  return (
    <section id="home-features">
      <Features {...props} />
    </section>
  );
}
