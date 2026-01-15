'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { ITodo } from '@/models/Todo';
import type { ITodoList } from '@/models/TodoList';

function TodosContent() {
  const [todos, setTodos] = useState<ITodo[]>([]);
  const [todoLists, setTodoLists] = useState<ITodoList[]>([]);
  const [selectedTodo, setSelectedTodo] = useState<ITodo | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showListForm, setShowListForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterList, setFilterList] = useState<string>('');
  const searchParams = useSearchParams();
  const router = useRouter();

  const fetchTodos = async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterList) params.set('list_id', filterList);
    
    const res = await fetch(`/api/todos?${params.toString()}`);
    const data = await res.json();
    if (data.success) {
      setTodos(data.data);
      const todoId = searchParams.get('todo');
      if (todoId) {
        const todo = data.data.find((t: ITodo) => t._id.toString() === todoId);
        if (todo) setSelectedTodo(todo);
      }
    }
  };

  const fetchTodoLists = async () => {
    const res = await fetch('/api/todo-lists?is_archived=false');
    const data = await res.json();
    if (data.success) {
      setTodoLists(data.data);
    }
  };

  useEffect(() => {
    Promise.all([fetchTodos(), fetchTodoLists()]).then(() => {
      setLoading(false);
    });
  }, [searchParams, filterStatus, filterList]);

  if (loading) {
    return <div className="min-h-screen p-8 bg-gray-50">Loading...</div>;
  }

  const handleCreateTodo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      status: formData.get('status') || 'pending',
      priority: formData.get('priority') || 'medium',
      assigned_to: formData.get('assigned_to'),
      created_by: formData.get('created_by'),
      location_id: formData.get('location_id') || undefined,
      team_id: formData.get('team_id') || undefined,
      list_id: formData.get('list_id') || undefined,
      is_public: formData.get('is_public') === 'true',
      due_date: formData.get('due_date') || undefined,
    };

    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowCreateForm(false);
      fetchTodos();
      fetchTodoLists();
    }
  };

  const handleCreateList = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      created_by: formData.get('created_by'),
      location_id: formData.get('location_id') || undefined,
      team_id: formData.get('team_id') || undefined,
      is_public: formData.get('is_public') === 'true',
    };

    const res = await fetch('/api/todo-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowListForm(false);
      fetchTodoLists();
    }
  };

  if (loading) {
    return <div className="min-h-screen p-8 bg-gray-50">Loading...</div>;
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => {
              const returnTo = searchParams.get('returnTo');
              if (returnTo) {
                router.push(returnTo);
              } else {
                router.back();
              }
            }}
            className="mb-4 text-blue-600 hover:text-blue-800"
          >
            ← Back
          </button>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-gray-900">Todos</h1>
              <p className="text-gray-700">Manage and track todos</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowListForm(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                + New List
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + New Todo
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filterList}
              onChange={(e) => setFilterList(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="">All Lists</option>
              {todoLists.map((list) => (
                <option key={list._id} value={list._id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {selectedTodo ? (
              <div className="bg-white border rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">{selectedTodo.title}</h2>
                  <button
                    onClick={() => setSelectedTodo(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                {selectedTodo.description && (
                  <p className="text-gray-700 mb-4">{selectedTodo.description}</p>
                )}
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`px-2 py-1 text-xs rounded ${
                      selectedTodo.status === 'completed' ? 'bg-green-100 text-green-800' :
                      selectedTodo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedTodo.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Priority:</span> {selectedTodo.priority}
                  </div>
                  {selectedTodo.assigned_to && (
                    <div>
                      <span className="font-medium">Assigned to:</span> {selectedTodo.assigned_to.name}
                    </div>
                  )}
                  {selectedTodo.list_id && (
                    <div>
                      <span className="font-medium">List:</span> {selectedTodo.list_id.name}
                    </div>
                  )}
                  {selectedTodo.linked_note && (
                    <div>
                      <span className="font-medium">Linked Note:</span> {selectedTodo.linked_note.title}
                    </div>
                  )}
                  {selectedTodo.linked_chat && (
                    <div>
                      <span className="font-medium">From Chat:</span> {selectedTodo.linked_chat.text?.substring(0, 50)}...
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {todos.length === 0 ? (
                  <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
                    No todos found. Create your first todo!
                  </div>
                ) : (
                  todos.map((todo) => (
                    <div
                      key={todo._id}
                      className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md"
                      onClick={() => setSelectedTodo(todo)}
                    >
                      <h3 className="font-semibold text-lg">{todo.title}</h3>
                      {todo.description && (
                        <p className="text-gray-600 text-sm mt-1">{todo.description}</p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-1 text-xs rounded ${
                          todo.status === 'completed' ? 'bg-green-100 text-green-800' :
                          todo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {todo.status}
                        </span>
                        <span className="px-2 py-1 text-xs bg-gray-100 rounded">{todo.priority}</span>
                        {todo.list_id && (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                            {todo.list_id.name}
                          </span>
                        )}
                        {todo.is_public && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Public
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Todo Lists */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Todo Lists</h3>
              <div className="space-y-2">
                {todoLists.map((list) => (
                  <div
                    key={list._id}
                    className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => setFilterList(list._id)}
                  >
                    <div className="font-medium">{list.name}</div>
                    <div className="text-xs text-gray-500">
                      {list.todos?.length || 0} todos
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Create Todo Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Create Todo</h2>
              <form onSubmit={handleCreateTodo} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input
                    name="title"
                    required
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Todo title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select name="status" className="w-full px-3 py-2 border rounded">
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select name="priority" className="w-full px-3 py-2 border rounded">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Assigned To (Member ID) *</label>
                  <input
                    name="assigned_to"
                    required
                    className="w-full px-3 py-2 border rounded"
                    placeholder="member_id"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Created By (Member ID) *</label>
                  <input
                    name="created_by"
                    required
                    className="w-full px-3 py-2 border rounded"
                    placeholder="member_id"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Todo List</label>
                  <select name="list_id" className="w-full px-3 py-2 border rounded">
                    <option value="">None</option>
                    {todoLists.map((list) => (
                      <option key={list._id} value={list._id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="is_public" value="true" id="is_public" />
                  <label htmlFor="is_public" className="text-sm">Make public (visible to managers)</label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create List Modal */}
        {showListForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Create Todo List</h2>
              <form onSubmit={handleCreateList} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    name="name"
                    required
                    className="w-full px-3 py-2 border rounded"
                    placeholder="List name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Created By (Member ID) *</label>
                  <input
                    name="created_by"
                    required
                    className="w-full px-3 py-2 border rounded"
                    placeholder="member_id"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="is_public" value="true" id="list_is_public" />
                  <label htmlFor="list_is_public" className="text-sm">Make public</label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowListForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TodosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-8 bg-gray-50">Loading...</div>}>
      <TodosContent />
    </Suspense>
  );
}
