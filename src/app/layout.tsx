import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Roboto } from 'next/font/google'

// Roboto across the whole app (self-hosted by Next.js, exposed as --font-sans)
const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '500', '700', '900'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  title: 'SiteSutra | Construction Management',
  description: 'Construction management system for sites, labour, materials, and accounting. Developed by Webrise Global.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SiteSutra' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f97316',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  )
}
