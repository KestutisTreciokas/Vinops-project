import './styles/globals.css';
import type { Metadata } from 'next';
import { PropsWithChildren } from 'react';

export const metadata: Metadata = {
  title: 'vinops — vinops',
  description: 'VIN lookup and auction history by vinops',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className="__variable_52ad5f __variable_f9e569 font-sans">
        {children}
      </body>
    </html>
  );
}
