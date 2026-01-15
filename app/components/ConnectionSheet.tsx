'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ConnectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'member' | 'team' | 'location';
  id: string;
}

export default function ConnectionSheet({ isOpen, onClose, title, type, id }: ConnectionSheetProps) {
  const [connections, setConnections] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && id) {
      setLoading(true);
      const endpoint = type === 'member' 
        ? `/api/members/${id}/connections`
        : type === 'team'
        ? `/api/teams/${id}/connections`
        : `/api/locations/${id}/connections`;

      fetch(endpoint)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setConnections(data.data);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load connections:', err);
          setLoading(false);
        });
    }
  }, [isOpen, id, type]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-[85%] max-w-4xl bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            ✕ Close
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading connections...</div>
          ) : connections ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {type === 'location' && (
                  <>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Teams</div>
                      <div className="text-3xl font-bold text-gray-900">{connections.teams || 0}</div>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <div className="text-sm text-gray-600">Members</div>
                      <div className="text-3xl font-bold text-indigo-700">{connections.members || 0}</div>
                    </div>
                  </>
                )}
                {type === 'team' && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">Members</div>
                    <div className="text-3xl font-bold text-gray-900">{connections.members || 0}</div>
                  </div>
                )}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Notes</div>
                  <div className="text-3xl font-bold text-blue-700">{connections.notes || 0}</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">Todos</div>
                  <div className="text-3xl font-bold text-green-700">{connections.todos || 0}</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">Decisions</div>
                  <div className="text-3xl font-bold text-purple-700">{connections.decisions || 0}</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-sm text-gray-600">Channels</div>
                  <div className="text-3xl font-bold text-orange-700">{connections.channels || 0}</div>
                </div>
              </div>

              {/* Notes Section */}
              {connections.details?.notes && connections.details.notes.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes ({connections.details.notes.length})</h3>
                  <div className="space-y-2">
                    {connections.details.notes.map((note: any) => (
                      <div 
                        key={note._id} 
                        className="p-4 bg-white border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/organization';
                          router.push(`/notes?note=${note._id}&returnTo=${encodeURIComponent(returnTo)}`);
                          onClose();
                        }}
                      >
                        <div className="font-semibold text-gray-900 mb-1">{note.title}</div>
                        <div className="text-sm text-gray-600 mb-2">{note.content}</div>
                        <div className="text-xs text-gray-500">
                          by{' '}
                          {note.author_id ? (
                            <a
                              href={`/members/${note.author_id._id || note.author_id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/members/${note.author_id._id || note.author_id}`);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {note.author_id.name || 'Unknown'}
                            </a>
                          ) : (
                            'Unknown'
                          )}{' '}
                          • {new Date(note.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Todos Section */}
              {connections.details?.todos && connections.details.todos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Todos ({connections.details.todos.length})</h3>
                  <div className="space-y-2">
                    {connections.details.todos.map((todo: any) => (
                      <div 
                        key={todo._id} 
                        className="p-4 bg-white border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/organization';
                          router.push(`/todos?todo=${todo._id}&returnTo=${encodeURIComponent(returnTo)}`);
                          onClose();
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold text-gray-900">{todo.title}</div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            todo.status === 'completed' ? 'bg-green-100 text-green-800' :
                            todo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {todo.status}
                          </span>
                        </div>
                        {todo.description && (
                          <div className="text-sm text-gray-600 mb-2">{todo.description}</div>
                        )}
                        <div className="text-xs text-gray-500">
                          Assigned to:{' '}
                          {todo.assigned_to ? (
                            <a
                              href={`/members/${todo.assigned_to._id || todo.assigned_to}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/members/${todo.assigned_to._id || todo.assigned_to}`);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {todo.assigned_to.name || 'Unknown'}
                            </a>
                          ) : (
                            'Unknown'
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions Section */}
              {connections.details?.decisions && connections.details.decisions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Decisions ({connections.details.decisions.length})</h3>
                  <div className="space-y-2">
                    {connections.details.decisions.map((decision: any) => (
                      <div 
                        key={decision._id} 
                        className="p-4 bg-white border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/organization';
                          router.push(`/decisions?decision=${decision._id}&returnTo=${encodeURIComponent(returnTo)}`);
                          onClose();
                        }}
                      >
                        <div className="font-semibold text-gray-900 mb-1">{decision.title}</div>
                        <div className="text-sm text-gray-600 mb-2">{decision.description}</div>
                        <div className="text-sm font-medium text-gray-700 mb-2">Decision: {decision.decision}</div>
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-1 text-xs rounded ${
                            decision.status === 'approved' ? 'bg-green-100 text-green-800' :
                            decision.status === 'implemented' ? 'bg-blue-100 text-blue-800' :
                            decision.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {decision.status}
                          </span>
                          <div className="text-xs text-gray-500">
                            by{' '}
                            {decision.created_by ? (
                              <a
                                href={`/members/${decision.created_by._id || decision.created_by}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/members/${decision.created_by._id || decision.created_by}`);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                {decision.created_by.name || 'Unknown'}
                              </a>
                            ) : (
                              'Unknown'
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Channels Section */}
              {connections.details?.channels && connections.details.channels.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Channels ({connections.details.channels.length})</h3>
                  <div className="space-y-2">
                    {connections.details.channels.map((channel: any) => (
                      <div 
                        key={channel._id} 
                        className="p-4 bg-white border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/organization';
                          router.push(`/channels/${channel._id}?returnTo=${encodeURIComponent(returnTo)}`);
                          onClose();
                        }}
                      >
                        <div className="font-semibold text-gray-900 mb-1">{channel.name}</div>
                        {channel.description && (
                          <div className="text-sm text-gray-600 mb-2">{channel.description}</div>
                        )}
                        <div className="text-xs text-gray-500">
                          {channel.members?.length || 0} members • Type: {channel.type}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No connections found</div>
          )}
        </div>
      </div>
    </>
  );
}
