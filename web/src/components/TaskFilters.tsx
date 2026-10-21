export type StatusFilter = 'all' | 'active' | 'completed';

const OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

interface Props {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}

export function TaskFilters({ status, onStatusChange }: Props) {
  return (
    <div>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={status === option.value}
          onClick={() => onStatusChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
