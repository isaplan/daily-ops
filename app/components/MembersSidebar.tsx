'use client'

import { useRouter } from 'next/navigation'
import { SidebarContent, SidebarHeader, SidebarTitle } from '@/components/ui/sidebar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface Member {
  _id: string
  name: string
}

interface MembersSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: Member[]
  membersCount: number
}

export function MembersSidebar({ open, onOpenChange, members, membersCount }: MembersSidebarProps) {
  const router = useRouter()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0 flex flex-col h-full">
        <SheetHeader className="border-b shrink-0 px-4 py-3">
          <SheetTitle>Members ({membersCount})</SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded-md transition-colors"
                  onClick={() => {
                    router.push(`/members/${member._id}`)
                    onOpenChange(false)
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground text-xs font-semibold">
                    {member.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm text-foreground">{member.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
