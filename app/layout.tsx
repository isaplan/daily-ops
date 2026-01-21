import type { Metadata } from 'next'
import './globals.css'
import { WorkspaceProvider } from '@/lib/workspaceContext'
import { EnvironmentProvider } from '@/lib/environmentContext'
import Sidebar from './components/Sidebar'

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
      <body>
        <WorkspaceProvider>
          <EnvironmentProvider>
            <div className="flex">
              <Sidebar />
              <main className="flex-1">{children}</main>
            </div>
          </EnvironmentProvider>
        </WorkspaceProvider>
      </body>
    </html>
  )
}
