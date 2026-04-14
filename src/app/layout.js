import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata = {
  title: 'trade-check',
  description: '外贸背调 · 证据驱动的风险分析',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans text-stripe-navy bg-white">{children}</body>
    </html>
  )
}
