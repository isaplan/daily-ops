import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import './globals.css'
import { Toaster } from 'sonner'

const LayoutClients = dynamic(() => import('./LayoutClients'), { ssr: true })

export const metadata: Metadata = {
  title: 'Daily Ops - POC',
  description: 'Daily Operations Hub - Proof of Concept',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden">
        <LayoutClients>{children}</LayoutClients>
        <Toaster />
      </body>
    </html>
  )
}
