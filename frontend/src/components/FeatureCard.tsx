// src/components/FeatureCard.tsx
import { ReactNode } from 'react';

type Props = {
  title: string;
  text?: string;
  description?: string; // на случай старых импортов
  icon: ReactNode;
  className?: string;
};

export default function FeatureCard({
  title,
  text,
  description,
  icon,
  className,
}: Props) {
  const body = text ?? description ?? '';

  return (
    <div className={`card p-4 md:p-5 ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-10 w-10 rounded-xl bg-[color-mix(in_hsl,var(--brand)_12%,transparent)] text-[var(--brand)] flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          {body && <div className="text-sm text-fg-muted mt-1">{body}</div>}
        </div>
      </div>
    </div>
  );
}
