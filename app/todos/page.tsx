'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function TodosContent() {
  const [todos, setTodos] = useState<any[]>([]);
  const [selectedTodo, setSelectedTodo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/todos')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTodos(data.data);
          const todoId = searchParams.get('todo');
          if (todoId) {
            const todo = data.data.find((t: any) => t._id === todoId);
            if (todo) setSelectedTodo(todo);
          }
        }
        setLoading(false);
      });
  }, [searchParams]);

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
          <h1 className="text-4xl font-bold mb-2 text-gray-900">Todos</h1>
          <p className="text-gray-700">Manage and track todos</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {selectedTodo ? (
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">{selectedTodo.title}</h2>
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
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {todos.map((todo) => (
                  <div
                    key={todo._id}
                    className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md"
                    onClick={() => setSelectedTodo(todo)}
                  >
                    <h3 className="font-semibold text-lg">{todo.title}</h3>
                    <div className="flex gap-2 mt-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        todo.status === 'completed' ? 'bg-green-100 text-green-800' :
                        todo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {todo.status}
                      </span>
                      <span className="px-2 py-1 text-xs bg-gray-100 rounded">{todo.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
