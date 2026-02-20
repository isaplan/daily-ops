'use client';

import dynamic from 'next/dynamic';
import { AuthProvider } from '@/lib/authContext';
import { WorkspaceProvider } from '@/lib/workspaceContext';
import { EnvironmentProvider } from '@/lib/environmentContext';
import { DesignModeProvider } from '@/lib/designMode';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

const SidebarWrapper = dynamic(() => import('@/components/SidebarWrapper'), {
  ssr: false,
  loading: () => null,
});

const ChannelHeader = dynamic(() => import('@/components/ChannelHeader').then((m) => ({ default: m.ChannelHeader })), {
  ssr: false,
  loading: () => <div className="h-10 w-48 animate-pulse rounded bg-muted" />,
});

export default function LayoutClients({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <EnvironmentProvider>
          <DesignModeProvider>
            <SidebarProvider>
          <SidebarWrapper />
          <SidebarInset className="flex flex-col h-screen">
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
              <SidebarTrigger />
              <ChannelHeader />
            </header>
            <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              {children}
            </main>
          </SidebarInset>
            </SidebarProvider>
          </DesignModeProvider>
        </EnvironmentProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
