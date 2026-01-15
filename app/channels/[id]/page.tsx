'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { parseMessage, getLinkUrl, getMentionUrl } from '@/lib/messageParser';
import MessageInput from '@/components/MessageInput';

function ChannelDetailContent() {
  const params = useParams();
  const router = useRouter();
  const channelId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  
  const [channel, setChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newMessage,
          channel_id: channelId,
          member_id: currentUser._id,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }

      const data = await res.json();
      if (data.success) {
        setNewMessage('');
        loadMessages();
        // Reload channel to get updated members list if members were added
        if (data.addedMembers && data.addedMembers.length > 0) {
          loadChannel();
        }
        // Scroll to bottom after sending
        setTimeout(() => {
          const container = document.getElementById('messages-container');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 100);
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/channels')}
              className="text-blue-600 hover:text-blue-800 mb-2"
            >
              ← Back to Channels
            </button>
            <h1 className="text-2xl font-bold text-gray-900">#{channel.name}</h1>
            {channel.description && (
              <p className="text-sm text-gray-600 mt-1">{channel.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{members.length}</span> members
            </div>
            <div className="text-xs text-gray-500 mt-1">{channel.type} channel</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" id="messages-container">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((message) => {
                // System messages have different styling
                if (message.is_system) {
                  return (
                    <div key={message._id} className="flex justify-center my-2">
                      <div className="text-sm text-gray-500 italic bg-gray-100 px-3 py-1 rounded-full">
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
                
                return (
                  <div key={message._id} className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {message.member_id?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <a
                          href={`/members/${message.member_id?._id || message.member_id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (message.member_id) {
                              router.push(`/members/${message.member_id._id || message.member_id}`);
                            }
                          }}
                          className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer"
                        >
                          {message.member_id?.name || 'Unknown'}
                        </a>
                        <span className="text-xs text-gray-500">
                          {new Date(message.timestamp || message.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-gray-800 whitespace-pre-wrap">
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
                                className="bg-blue-100 text-blue-800 px-1 rounded font-medium cursor-pointer hover:bg-blue-200"
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
                                className="bg-purple-100 text-purple-800 px-1 rounded font-medium cursor-pointer hover:bg-purple-200"
                              >
                                {part.content}
                              </a>
                            );
                          }
                          return <span key={idx}>{part.content}</span>;
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message Input */}
          <div className="border-t bg-white p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <div className="flex-1">
                <MessageInput
                  value={newMessage}
                  onChange={setNewMessage}
                  onSubmit={handleSendMessage}
                  disabled={sending || !currentUser}
                  placeholder={`Message #${channel.name}`}
                  members={allMembers}
                  notes={notes}
                  todos={todos}
                  events={events}
                  channels={channels}
                  decisions={decisions}
                />
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim() || sending || !currentUser}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar - Members */}
        <div className="w-64 bg-white border-l p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Members ({members.length})</h2>
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-sm text-gray-500">No members</p>
            ) : (
              members.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                  onClick={() => router.push(`/members/${member._id}`)}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-semibold">
                    {member.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <a
                    href={`/members/${member._id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/members/${member._id}`);
                    }}
                    className="text-sm text-gray-900 hover:text-blue-600"
                  >
                    {member.name}
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
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
