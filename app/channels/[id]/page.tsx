'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { parseMessage, getLinkUrl, getMentionUrl } from '@/lib/messageParser';
import { parseMarkdown } from '@/lib/utils/markdown';
import ChatInput from '@/components/chats/ChatInput';
import { chatService } from '@/lib/services/chatService';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Check, X } from 'lucide-react';
import type { IChannel } from '@/models/Channel';
import type { IMessage } from '@/models/Message';
import type { IMember } from '@/models/Member';
import type { INote } from '@/models/Note';
import type { ITodo } from '@/models/Todo';
import type { IEvent } from '@/models/Event';
import type { IDecision } from '@/models/Decision';

function ChannelDetailContent() {
  const params = useParams();
  const router = useRouter();
  const channelId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  
  const [channel, setChannel] = useState<IChannel | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [editorHtml, setEditorHtml] = useState('');
  const [editorPlainText, setEditorPlainText] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; url: string; type: string; mimeType: string; size: number; filename?: string }>>([]);
  const [members, setMembers] = useState<IMember[]>([]);
  const [currentUser, setCurrentUser] = useState<IMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [allMembers, setAllMembers] = useState<IMember[]>([]);
  const [notes, setNotes] = useState<INote[]>([]);
  const [todos, setTodos] = useState<ITodo[]>([]);
  const [events, setEvents] = useState<IEvent[]>([]);
  const [channels, setChannels] = useState<IChannel[]>([]);
  const [decisions, setDecisions] = useState<IDecision[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editHtml, setEditHtml] = useState('');

  useEffect(() => {
    if (!channelId) return;
    
    // Load all data for parsing
    Promise.all([
      fetch('/api/members').then(r => r.json()),
      fetch('/api/notes').then(r => r.json()),
      fetch('/api/todos').then(r => r.json()),
      fetch('/api/events').then(r => r.json()),
      fetch('/api/channels').then(r => r.json()),
      fetch('/api/decisions').then(r => r.json()),
    ]).then(([membersRes, notesRes, todosRes, eventsRes, channelsRes, decisionsRes]) => {
      if (membersRes.success) {
        setAllMembers(membersRes.data);
        if (membersRes.data.length > 0) {
          setCurrentUser(membersRes.data[0]);
        }
      }
      if (notesRes.success) setNotes(notesRes.data);
      if (todosRes.success) setTodos(todosRes.data);
      if (eventsRes.success) setEvents(eventsRes.data);
      if (channelsRes.success) setChannels(channelsRes.data);
      if (decisionsRes.success) setDecisions(decisionsRes.data);
    });

    // Load channel
    fetch(`/api/channels/${channelId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setChannel(data.data);
          setMembers(data.data.members || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load channel:', err);
        setLoading(false);
      });

    // Load messages
    loadMessages();
    
    // Auto-refresh messages every 5 seconds
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [channelId]);

  const loadMessages = () => {
    fetch(`/api/messages?channel_id=${channelId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setMessages(data.data);
          // Auto-scroll to bottom on new messages
          setTimeout(() => {
            const container = document.getElementById('messages-container');
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 100);
        }
      })
      .catch((err) => {
        console.error('Failed to load messages:', err);
      });
  };

  const loadChannel = async () => {
    if (!channelId) return;
    try {
      const res = await fetch(`/api/channels/${channelId}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success) {
            setChannel(data.data);
            setMembers(data.data.members || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load channel:', err);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    const message = messages.find(m => m._id === messageId);
    if (!message) return;
    
    setEditingMessageId(messageId);
    setEditText(message.text || '');
    setEditHtml(message.text || '');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editText.trim()) return;
    
    try {
      const parsed = parseMarkdown(editText);
      const response = await fetch(`/api/messages/${editingMessageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: parsed.plainText,
          editor_content: parsed.html,
          plainText: parsed.plainText,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setEditingMessageId(null);
        setEditText('');
        setEditHtml('');
        loadMessages();
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
    setEditHtml('');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      if (data.success) {
        loadMessages();
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleSendMessage = async (
    html: string,
    plainText: string,
    messageAttachments?: Array<{ id: string; url: string; type: string; mimeType: string; size: number; filename?: string }>
  ) => {
    if ((!plainText.trim() && (!messageAttachments || messageAttachments.length === 0)) || !currentUser || !channelId) return;

    setSending(true);
    try {
      // Extract mentions from markdown HTML
      const mentionIds: string[] = [];
      const mentionRegex = /data-mention="([^"]+)"/g;
      let match;
      while ((match = mentionRegex.exec(html)) !== null) {
        mentionIds.push(match[1]);
      }
      
      // Also extract from plain text as fallback: @username
      const plainTextMentions = plainText.match(/@(\w+)/g) || [];
      plainTextMentions.forEach((mention) => {
        const username = mention.substring(1);
        if (!mentionIds.includes(username)) {
          mentionIds.push(username);
        }
      });

      const response = await chatService.sendMessage({
        channelId,
        editorHtml: html,
        plainText,
        mentionedMembers: mentionIds,
        attachments: messageAttachments?.map((att) => ({
          id: att.id,
          url: att.url,
          type: att.type as 'image' | 'video' | 'file',
          mimeType: att.mimeType,
          size: att.size,
          filename: att.filename,
        })) || [],
      });

      if (response.success) {
        setEditorHtml('');
        setEditorPlainText('');
        setAttachments([]);
        loadMessages();
        // Scroll to bottom after sending
        setTimeout(() => {
          const container = document.getElementById('messages-container');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 100);
      } else {
        console.error('Failed to send message:', response.error);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-8 bg-gray-50">Loading channel...</div>;
  }

  if (!channel) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">Channel not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Messages Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" id="messages-container">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => {
            // System messages have different styling
            if (message.is_system) {
              return (
                <div key={message._id} className="flex justify-center my-2">
                  <div className="text-sm text-muted-foreground italic bg-muted px-3 py-1 rounded-full">
                    {message.text}
                  </div>
                </div>
              );
            }
            
            const parsed = parseMessage(
              message.text,
              allMembers,
              notes,
              todos,
              events,
              channels,
              decisions
            );
            
            const messageMemberId = typeof message.member_id === 'object' 
              ? (message.member_id._id || message.member_id) 
              : message.member_id;
            const currentUserId = currentUser?._id;
            const isOwnMessage = currentUser && currentUserId && (
              String(messageMemberId) === String(currentUserId)
            );
            const isEditing = editingMessageId === message._id;

            return (
              <div key={message._id} className="flex gap-3 group hover:bg-muted/30 p-2 rounded-lg transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold flex-shrink-0">
                  {message.member_id?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <a
                      href={`/members/${message.member_id?._id || message.member_id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        if (message.member_id) {
                          router.push(`/members/${message.member_id._id || message.member_id}`);
                        }
                      }}
                      className="font-semibold text-foreground hover:text-primary cursor-pointer"
                    >
                      {message.member_id?.name || 'Unknown'}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.timestamp || message.created_at).toLocaleString()}
                    </span>
                    {message.edited_at && (
                      <span className="text-xs text-muted-foreground/70">(edited)</span>
                    )}
                    {isOwnMessage && !isEditing && (
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEditMessage(message._id)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteMessage(message._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <ChatInput
                        content={editText}
                        onChange={(html, plainText) => {
                          setEditHtml(html);
                          setEditText(plainText);
                        }}
                        onSubmit={() => handleSaveEdit()}
                        placeholder="Edit your message..."
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          className="h-8"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          className="h-8"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-foreground whitespace-pre-wrap">
                      {parsed.parts.map((part, idx) => {
                        if (part.type === 'text') {
                          return <span key={idx}>{part.content}</span>;
                        } else if (part.type === 'mention') {
                          const mention = parsed.mentions.find(m => m.startIndex === part.startIndex);
                          return (
                            <a
                              key={idx}
                              href={mention ? getMentionUrl(mention) : '#'}
                              onClick={(e) => {
                                e.preventDefault();
                                if (mention) {
                                  router.push(getMentionUrl(mention));
                                }
                              }}
                              className="bg-primary/10 text-primary px-1 rounded font-medium cursor-pointer hover:bg-primary/20"
                              title={`View ${mention?.name || 'member'}'s profile`}
                            >
                              {part.content}
                            </a>
                          );
                        } else if (part.type === 'link') {
                          const link = parsed.links.find(l => l.startIndex === part.startIndex);
                          return (
                            <a
                              key={idx}
                              href={link ? getLinkUrl(link) : '#'}
                              onClick={(e) => {
                                e.preventDefault();
                                if (link && typeof window !== 'undefined') {
                                  window.location.href = getLinkUrl(link);
                                }
                              }}
                              className="bg-secondary text-secondary-foreground px-1 rounded font-medium cursor-pointer hover:bg-secondary/80"
                            >
                              {part.content}
                            </a>
                          );
                        }
                        return <span key={idx}>{part.content}</span>;
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input - Sticky to Bottom */}
      <div className="sticky bottom-0 border-t bg-background p-4 shrink-0 z-10">
          <ChatInput
            content={editorPlainText}
            onChange={(html, plainText, messageAttachments) => {
              setEditorHtml(html);
              setEditorPlainText(plainText);
              setAttachments(messageAttachments || []);
            }}
            onSubmit={(html, plainText, messageAttachments) => {
              setEditorHtml(html);
              setEditorPlainText(plainText);
              setAttachments(messageAttachments || []);
              handleSendMessage(html, plainText, messageAttachments);
            }}
            placeholder={`Type a message... Use @ for mentions, # for channels`}
            disabled={sending || !currentUser}
          />
      </div>
    </div>
  );
}

export default function ChannelDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <ChannelDetailContent />
    </Suspense>
  );
}
