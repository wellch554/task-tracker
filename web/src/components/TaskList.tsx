import type { Task } from '../api/client';
import { TaskItem } from './TaskItem';

interface Props {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, onToggle, onDelete }: Props) {
  return (
    <ul aria-label="Tasks">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </ul>
  );
}
