import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
  description: 'My application',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
