'use client';

import { useState, useEffect, useRef } from 'react';

interface Member {
  _id: string;
  name: string;
}

interface ContentItem {
  _id: string;
  title?: string;
  name?: string;
  type: 'note' | 'todo' | 'event' | 'channel' | 'decision';
}

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  members: Member[];
  notes?: Array<{ _id: string; title: string }>;
  todos?: Array<{ _id: string; title: string }>;
  events?: Array<{ _id: string; name: string }>;
  channels?: Array<{ _id: string; name: string }>;
  decisions?: Array<{ _id: string; title: string }>;
}

export default function MessageInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  members,
  notes = [],
  todos = [],
  events = [],
  channels = [],
  decisions = [],
}: MessageInputProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<Array<Member | ContentItem>>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteType, setAutocompleteType] = useState<'mention' | 'link' | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check for @mention
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = members.filter((m) =>
        m.name.toLowerCase().includes(query) ||
        m.name.toLowerCase().replace(/\s+/g, '').includes(query)
      );
      setAutocompleteItems(filtered);
      setAutocompleteType('mention');
      setAutocompleteIndex(0);
      setShowAutocomplete(true);
      return;
    }

    // Check for #link
    const linkMatch = textBeforeCursor.match(/#(\w*)$/);
    
    if (linkMatch) {
      const query = linkMatch[1].toLowerCase();
      const allItems: ContentItem[] = [
        ...notes.map(n => ({ _id: n._id, title: n.title, type: 'note' as const })),
        ...todos.map(t => ({ _id: t._id, title: t.title, type: 'todo' as const })),
        ...events.map(e => ({ _id: e._id, name: e.name, type: 'event' as const })),
        ...channels.map(c => ({ _id: c._id, name: c.name, type: 'channel' as const })),
        ...decisions.map(d => ({ _id: d._id, title: d.title, type: 'decision' as const })),
      ].filter((item) => {
        const searchText = (item.title || item.name || '').toLowerCase();
        return searchText.includes(query) || searchText.replace(/\s+/g, '').includes(query);
      });
      
      setAutocompleteItems(allItems);
      setAutocompleteType('link');
      setAutocompleteIndex(0);
      setShowAutocomplete(true);
      return;
    }

    setShowAutocomplete(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete) {
      if (e.key === 'Enter' && !e.shiftKey) {
        onSubmit(e as any);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocompleteIndex((prev) => 
        prev < autocompleteItems.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocompleteIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectAutocompleteItem(autocompleteItems[autocompleteIndex]);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  const selectAutocompleteItem = (item: Member | ContentItem) => {
    if (!inputRef.current) return;

    const cursorPos = cursorPosition;
    const textBeforeCursor = value.substring(0, cursorPos);
    
    let replacement = '';
    let newText = '';
    
    if (autocompleteType === 'mention' && 'name' in item) {
      replacement = `@${item.name}`;
      const match = textBeforeCursor.match(/@(\w*)$/);
      if (match && match.index !== undefined) {
        newText = value.substring(0, match.index) + replacement + ' ' + value.substring(cursorPos);
      }
    } else if (autocompleteType === 'link') {
      const displayName = (item as ContentItem).title || (item as ContentItem).name || '';
      replacement = `#${displayName}`;
      const match = textBeforeCursor.match(/#(\w*)$/);
      if (match && match.index !== undefined) {
        newText = value.substring(0, match.index) + replacement + ' ' + value.substring(cursorPos);
      }
    }

    onChange(newText);
    setShowAutocomplete(false);
    
    // Set cursor position after the replacement
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = (textBeforeCursor.match(/[@#]/)?.index || 0) + replacement.length;
        inputRef.current.setSelectionRange(newPos, newPos);
        inputRef.current.focus();
      }
    }, 0);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          const cursorPos = e.target.selectionStart || 0;
          setCursorPosition(cursorPos);
          const textBeforeCursor = value.substring(0, cursorPos);
          if (textBeforeCursor.match(/@(\w*)$/) || textBeforeCursor.match(/#(\w*)$/)) {
            handleInputChange(e as any);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      {showAutocomplete && autocompleteItems.length > 0 && (
        <div
          ref={autocompleteRef}
          className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50"
          style={{ maxWidth: '100%' }}
        >
          {autocompleteItems.map((item, idx) => {
            const isMember = 'name' in item && !('type' in item);
            const displayName = isMember 
              ? (item as Member).name
              : ((item as ContentItem).title || (item as ContentItem).name || '');
            const typeLabel = isMember ? 'Member' : (item as ContentItem).type;
            
            return (
              <div
                key={isMember ? (item as Member)._id : (item as ContentItem)._id}
                onClick={() => selectAutocompleteItem(item)}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                  idx === autocompleteIndex ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {autocompleteType === 'mention' ? '@' : '#'}{displayName}
                    </div>
                    <div className="text-xs text-gray-500">{typeLabel}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
