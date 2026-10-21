import { useState, type FormEvent } from 'react';

interface Props {
  onAdd: (title: string) => Promise<boolean>;
}

export function AddTaskForm({ onAdd }: Props) {
  const [title, setTitle] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    if (await onAdd(title.trim())) setTitle('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        New task
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button type="submit">Add task</button>
    </form>
  );
}
