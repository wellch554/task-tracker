import { useState } from 'react';
import { AddTaskForm } from './components/AddTaskForm';
import { TaskFilters, type StatusFilter } from './components/TaskFilters';
import { TaskList } from './components/TaskList';
import { useTasks } from './hooks/useTasks';

export default function App() {
  const { tasks, error, addTask, toggleTask, deleteTask } = useTasks();
  const [status, setStatus] = useState<StatusFilter>('all');

  const visible = status === 'all' ? tasks : tasks.filter((t) => t.completed === (status === 'completed'));

  return (
    <main>
      <h1>Task Tracker</h1>
      {error && <p role="alert">{error}</p>}
      <AddTaskForm onAdd={addTask} />
      <TaskFilters status={status} onStatusChange={setStatus} />
      {tasks.length === 0 && <p>No tasks yet</p>}
      <TaskList tasks={visible} onToggle={toggleTask} onDelete={deleteTask} />
    </main>
  );
}
