import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MOD_TRANSLATOR // Minecraft Localization Engine',
  description: 'Автоматический переводчик модов Minecraft на русский язык через DeepL API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}