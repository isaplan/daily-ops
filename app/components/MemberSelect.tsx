'use client';

import { useEffect, useState, useRef } from 'react';

interface Member {
  _id: string;
  name: string;
  email: string;
}

interface MemberSelectProps {
  name: string;
  label: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export default function MemberSelect({
  name,
  label,
  required = false,
  value = '',
  onChange,
  className = '',
}: MemberSelectProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/members')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMembers(data.data);
          setFilteredMembers(data.data);
        }
      })
      .catch((err) => console.error('Failed to load members:', err));
  }, []);

  useEffect(() => {
    if (value && members.length > 0) {
      const member = members.find((m) => m._id === value);
      if (member) {
        setSelectedMember(member);
        setSearchTerm(member.name);
      }
    }
  }, [value, members]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter(
        (member) =>
          member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          member.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMembers(filtered);
    }
  }, [searchTerm, members]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (member: Member) => {
    setSelectedMember(member);
    setSearchTerm(member.name);
    setIsOpen(false);
    if (onChange) {
      onChange(member._id);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setSelectedMember(null);
    if (onChange) {
      onChange('');
    }
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <label className="block text-sm font-medium mb-1">
        {label} {required && '*'}
      </label>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className="w-full px-3 py-2 border rounded bg-white text-gray-900"
          placeholder="Search member by name or email..."
          autoComplete="off"
        />
        <input
          type="hidden"
          name={name}
          value={selectedMember?._id || ''}
          required={required}
        />
        {isOpen && filteredMembers.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredMembers.map((member) => (
              <div
                key={member._id}
                onClick={() => handleSelect(member)}
                className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
                  selectedMember?._id === member._id ? 'bg-blue-100' : ''
                }`}
              >
                <div className="font-medium text-gray-900">{member.name}</div>
                <div className="text-sm text-gray-500">{member.email}</div>
              </div>
            ))}
          </div>
        )}
        {isOpen && searchTerm && filteredMembers.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-sm text-gray-500">
            No members found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
