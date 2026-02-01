'use client';

import { WorkspaceProvider } from '@/lib/workspaceContext';
import { EnvironmentProvider } from '@/lib/environmentContext';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import SidebarWrapper from './components/SidebarWrapper';
import { ChannelHeader } from './components/ChannelHeader';

export default function LayoutClients({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <EnvironmentProvider>
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
      </EnvironmentProvider>
    </WorkspaceProvider>
  );
}
