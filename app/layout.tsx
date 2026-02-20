import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import LayoutClients from './LayoutClients'

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
