import type { Metadata } from 'next'
import './globals.css'
import { DesignModeProvider } from '@/lib/designMode'
import { WorkspaceProvider } from '@/lib/workspaceContext'
import { EnvironmentProvider } from '@/lib/environmentContext'
import ClassicLayout from './components/layouts/ClassicLayout'
import DesignV2Layout from './components/layouts/DesignV2Layout'

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
        <DesignModeProvider>
          <WorkspaceProvider>
            <EnvironmentProvider>
              <ClassicLayout>{children}</ClassicLayout>
              <DesignV2Layout>{children}</DesignV2Layout>
            </EnvironmentProvider>
          </WorkspaceProvider>
        </DesignModeProvider>
      </body>
    </html>
  )
}
