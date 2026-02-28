import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '51期 六華同窓会 スケジュール',
  description: '51期六華同窓会のスケジュール管理システム',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans">
        {children}
      </body>
    </html>
  )
}
