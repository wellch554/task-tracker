export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

function sendJson(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function listTasks() {
  return request<Task[]>('/api/tasks');
}

export function createTask(title: string) {
  return request<Task>('/api/tasks', sendJson('POST', { title }));
}

export function setTaskCompleted(id: string, completed: boolean) {
  return request<Task>(`/api/tasks/${id}`, sendJson('PATCH', { completed }));
}

export function deleteTask(id: string) {
  return request<void>(`/api/tasks/${id}`, { method: 'DELETE' });
}
