/**
 * @registry-id: messageParser
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Parse @mentions and #links from message text
 * @last-fix: [2026-01-15] Initial implementation
 */

import React from 'react';

export interface ParsedMention {
  type: 'member';
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedLink {
  type: 'note' | 'todo' | 'event' | 'channel' | 'decision';
  id?: string;
  name: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedMessagePart {
  type: 'text' | 'mention' | 'link';
  content: string;
  data?: ParsedMention | ParsedLink;
  startIndex?: number;
  endIndex?: number;
}

export interface ParsedMessage {
  text: string;
  mentions: ParsedMention[];
  links: ParsedLink[];
  parts: ParsedMessagePart[];
}

export function parseMessage(
  text: string,
  members: Array<{ _id: string; name: string }>,
  notes?: Array<{ _id: string; title: string }>,
  todos?: Array<{ _id: string; title: string }>,
  events?: Array<{ _id: string; name: string }>,
  channels?: Array<{ _id: string; name: string }>,
  decisions?: Array<{ _id: string; title: string }>
): ParsedMessage {
  const mentions: ParsedMention[] = [];
  const links: ParsedLink[] = [];
  const parts: ParsedMessagePart[] = [];
  
  let lastIndex = 0;
  let currentIndex = 0;
  
  // Parse @mentions
  const mentionRegex = /@(\w+)/g;
  let mentionMatch;
  
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    const mentionText = mentionMatch[1];
    const member = members.find(
      (m) => m.name.toLowerCase().includes(mentionText.toLowerCase()) ||
      m.name.toLowerCase().replace(/\s+/g, '').includes(mentionText.toLowerCase())
    );
    
    if (member) {
      if (mentionMatch.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, mentionMatch.index),
        });
      }
      
      parts.push({
        type: 'mention',
        content: `@${member.name}`,
        data: member,
      });
      
      mentions.push({
        type: 'member',
        id: member._id,
        name: member.name,
        startIndex: mentionMatch.index,
        endIndex: mentionMatch.index + mentionMatch[0].length,
      });
      
      lastIndex = mentionMatch.index + mentionMatch[0].length;
    }
  }
  
  // Reset for link parsing
  lastIndex = 0;
  
  // Parse #links
  const linkRegex = /#(\w+)/g;
  let linkMatch;
  interface LinkMatch {
    match: RegExpMatchArray;
    type: string;
    item: { _id: string; title?: string; name?: string };
  }
  const linkMatches: LinkMatch[] = [];
  
  while ((linkMatch = linkRegex.exec(text)) !== null) {
    const linkText = linkMatch[1].toLowerCase();
    
    // Try to find in different content types
    let foundItem: { _id: string; title?: string; name?: string } | null = null;
    let itemType: string = '';
    
    // Check notes
    if (notes) {
      foundItem = notes.find((n) => 
        n.title.toLowerCase().includes(linkText) ||
        n.title.toLowerCase().replace(/\s+/g, '').includes(linkText)
      );
      if (foundItem) itemType = 'note';
    }
    
    // Check todos
    if (!foundItem && todos) {
      foundItem = todos.find((t) => 
        t.title.toLowerCase().includes(linkText) ||
        t.title.toLowerCase().replace(/\s+/g, '').includes(linkText)
      );
      if (foundItem) itemType = 'todo';
    }
    
    // Check events
    if (!foundItem && events) {
      foundItem = events.find((e) => 
        e.name.toLowerCase().includes(linkText) ||
        e.name.toLowerCase().replace(/\s+/g, '').includes(linkText)
      );
      if (foundItem) itemType = 'event';
    }
    
    // Check channels
    if (!foundItem && channels) {
      foundItem = channels.find((c) => 
        c.name.toLowerCase().includes(linkText) ||
        c.name.toLowerCase().replace(/\s+/g, '').includes(linkText)
      );
      if (foundItem) itemType = 'channel';
    }
    
    // Check decisions
    if (!foundItem && decisions) {
      foundItem = decisions.find((d) => 
        d.title.toLowerCase().includes(linkText) ||
        d.title.toLowerCase().replace(/\s+/g, '').includes(linkText)
      );
      if (foundItem) itemType = 'decision';
    }
    
    if (foundItem) {
      linkMatches.push({
        match: linkMatch,
        type: itemType,
        item: foundItem,
      });
    }
  }
  
  // Build final parts array combining text, mentions, and links
  const allMatches = [
    ...mentions.map(m => ({ type: 'mention' as const, index: m.startIndex, end: m.endIndex, data: m })),
    ...linkMatches.map(l => ({ 
      type: 'link' as const, 
      index: l.match.index!, 
      end: l.match.index! + l.match[0].length, 
      data: { type: l.type, id: l.item._id, name: l.item.title || l.item.name } 
    }))
  ].sort((a, b) => a.index - b.index);
  
  lastIndex = 0;
  const finalParts: ParsedMessagePart[] = [];
  
  allMatches.forEach((match) => {
    if (match.index > lastIndex) {
      finalParts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }
    
    if (match.type === 'mention') {
      const mention = mentions.find(m => m.startIndex === match.index);
      if (mention) {
        finalParts.push({
          type: 'mention',
          content: text.substring(match.index, match.end),
          data: mention,
          startIndex: match.index,
          endIndex: match.end,
        });
      }
    } else if (match.type === 'link') {
      finalParts.push({
        type: 'link',
        content: text.substring(match.index, match.end),
        data: match.data,
        startIndex: match.index,
        endIndex: match.end,
      });
      links.push({
        type: match.data.type as ParsedLink['type'],
        id: match.data.id,
        name: match.data.name,
        startIndex: match.index,
        endIndex: match.end,
      });
    }
    
    lastIndex = match.end;
  });
  
  if (lastIndex < text.length) {
    finalParts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }
  
  // If no matches, return original text
  if (finalParts.length === 0) {
    finalParts.push({
      type: 'text',
      content: text,
    });
  }
  
  return {
    text,
    mentions,
    links,
    parts: finalParts,
  };
}

export function getLinkUrl(link: ParsedLink): string {
  if (!link.id) return '#';
  switch (link.type) {
    case 'note':
      return `/notes?note=${link.id}`;
    case 'todo':
      return `/todos?todo=${link.id}`;
    case 'event':
      return `/events?event=${link.id}`;
    case 'channel':
      return `/channels/${link.id}`;
    case 'decision':
      return `/decisions?decision=${link.id}`;
    default:
      return '#';
  }
}

export function getMentionUrl(mention: ParsedMention): string {
  return `/members/${mention.id}`;
}
