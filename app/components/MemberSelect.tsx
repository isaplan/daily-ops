/**
 * @registry-id: MemberSelectComponent
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Member select component using microcomponents with search
 * @last-fix: [2026-01-16] Refactored to use Select microcomponent + memberService
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useMemberViewModel.ts => Member ViewModel
 *   - app/components/ui/** => Microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/** => Components use MemberSelect for member selection
 */

'use client'

import { useEffect, useState } from 'react'
import { useMemberViewModel } from '@/lib/viewmodels/useMemberViewModel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface MemberSelectProps {
  name: string
  label: string
  required?: boolean
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export default function MemberSelect({
  name,
  label,
  required = false,
  value = '',
  onChange,
  className = '',
}: MemberSelectProps) {
  const viewModel = useMemberViewModel()
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    viewModel.loadMembers()
  }, [])

  useEffect(() => {
    if (value && viewModel.members.length > 0) {
      const member = viewModel.members.find((m) => m._id === value)
      if (member) {
        setSearchTerm(member.name)
      }
    }
  }, [value, viewModel.members])

  const filteredMembers = searchTerm.trim() === ''
    ? viewModel.members
    : viewModel.members.filter(
        (member) =>
          member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          member.email.toLowerCase().includes(searchTerm.toLowerCase())
      )

  const selectedMember = viewModel.members.find((m) => m._id === value)

  const handleSelect = (memberId: string) => {
    const member = viewModel.members.find((m) => m._id === memberId)
    if (member) {
      setSearchTerm(member.name)
      setIsOpen(false)
      onChange?.(memberId)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Label htmlFor={name}>
        {label} {required && '*'}
      </Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            onClick={() => setIsOpen(true)}
          >
            {selectedMember ? selectedMember.name : 'Search member by name or email...'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-60 overflow-auto">
              {filteredMembers.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No members found
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <div
                    key={member._id}
                    onClick={() => handleSelect(member._id)}
                    className={cn(
                      'px-4 py-2 cursor-pointer hover:bg-accent',
                      selectedMember?._id === member._id && 'bg-accent'
                    )}
                  >
                    <div className="font-medium">{member.name}</div>
                    <div className="text-sm text-muted-foreground">{member.email}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={value} required={required} />
    </div>
  )
}
