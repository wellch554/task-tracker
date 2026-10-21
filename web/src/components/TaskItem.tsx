import type { Task } from '../api/client';

interface Props {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onToggle, onDelete }: Props) {
  return (
    <li>
      <label>
        <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)} />
        {task.title}
      </label>
      <button type="button" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>
        Delete
      </button>
    </li>
  );
}
