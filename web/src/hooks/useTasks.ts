import { useEffect, useState } from 'react';
import * as api from '../api/client';
import type { Task } from '../api/client';

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Runs a request, clearing the error on success and recording it on failure.
  async function run(action: () => Promise<void>): Promise<boolean> {
    try {
      await action();
      setError(null);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    }
  }

  useEffect(() => {
    api.listTasks().then(setTasks, (err: unknown) => setError(errorMessage(err)));
  }, []);

  return {
    tasks,
    error,
    addTask: (title: string) =>
      run(async () => {
        const task = await api.createTask(title);
        setTasks((prev) => [...prev, task]);
      }),
    toggleTask: (task: Task) =>
      run(async () => {
        const updated = await api.setTaskCompleted(task.id, !task.completed);
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }),
    deleteTask: (id: string) =>
      run(async () => {
        await api.deleteTask(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
      }),
  };
}
