import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const milk = {
  id: '1',
  title: 'Buy milk',
  completed: false,
  priority: 'medium',
  dueDate: null,
  createdAt: '2026-10-20T09:00:00.000Z',
};

const dog = {
  id: '2',
  title: 'Walk the dog',
  completed: true,
  priority: 'high',
  dueDate: '2026-10-21',
  createdAt: '2026-10-20T10:00:00.000Z',
};

type Reply = { status: number; body?: unknown };

// Stubs global fetch with canned replies keyed by "METHOD /path".
// Any request without a reply fails the test.
function mockApi(replies: Record<string, Reply>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    const reply = replies[key];
    if (!reply) throw new Error(`Unexpected request: ${key}`);
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestBody(fetchMock: ReturnType<typeof mockApi>, method: string, url: string) {
  const call = fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method);
  if (!call) throw new Error(`No ${method} ${url} request was made`);
  return JSON.parse(String(call[1]?.body));
}

function taskList() {
  return screen.getByRole('list', { name: 'Tasks' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the app heading', () => {
    mockApi({ 'GET /api/tasks': { status: 200, body: [] } });
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Task Tracker' })).toBeInTheDocument();
  });

  describe('task list', () => {
    it('renders the tasks loaded from the API', async () => {
      mockApi({ 'GET /api/tasks': { status: 200, body: [milk, dog] } });
      render(<App />);

      expect(await screen.findByRole('checkbox', { name: 'Buy milk' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Walk the dog' })).toBeChecked();
      expect(within(taskList()).getAllByRole('listitem')).toHaveLength(2);
    });

    it('shows an empty state when there are no tasks', async () => {
      mockApi({ 'GET /api/tasks': { status: 200, body: [] } });
      render(<App />);

      expect(await screen.findByText(/no tasks yet/i)).toBeInTheDocument();
    });
  });

  describe('adding a task', () => {
    it('posts the new task and shows it in the list', async () => {
      const created = { ...milk, id: '3', title: 'Write tests' };
      const fetchMock = mockApi({
        'GET /api/tasks': { status: 200, body: [] },
        'POST /api/tasks': { status: 201, body: created },
      });
      render(<App />);

      const input = await screen.findByRole('textbox', { name: 'New task' });
      fireEvent.change(input, { target: { value: 'Write tests' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

      expect(await screen.findByRole('checkbox', { name: 'Write tests' })).toBeInTheDocument();
      expect(requestBody(fetchMock, 'POST', '/api/tasks')).toMatchObject({ title: 'Write tests' });
      expect(input).toHaveValue('');
    });
  });

  describe('completing a task', () => {
    it('patches the task and shows it as completed', async () => {
      const fetchMock = mockApi({
        'GET /api/tasks': { status: 200, body: [milk] },
        'PATCH /api/tasks/1': { status: 200, body: { ...milk, completed: true } },
      });
      render(<App />);

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Buy milk' }));

      await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Buy milk' })).toBeChecked());
      expect(requestBody(fetchMock, 'PATCH', '/api/tasks/1')).toEqual({ completed: true });
    });
  });

  describe('deleting a task', () => {
    it('deletes the task and removes it from the list', async () => {
      const fetchMock = mockApi({
        'GET /api/tasks': { status: 200, body: [milk, dog] },
        'DELETE /api/tasks/1': { status: 204 },
      });
      render(<App />);

      fireEvent.click(await screen.findByRole('button', { name: 'Delete Buy milk' }));

      await waitFor(() => expect(screen.queryByText('Buy milk')).not.toBeInTheDocument());
      expect(screen.getByText('Walk the dog')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith('/api/tasks/1', expect.objectContaining({ method: 'DELETE' }));
    });
  });

  describe('filtering by status', () => {
    it('shows only active, only completed, or all tasks without refetching', async () => {
      const fetchMock = mockApi({ 'GET /api/tasks': { status: 200, body: [milk, dog] } });
      render(<App />);
      await screen.findByText('Buy milk');

      fireEvent.click(screen.getByRole('button', { name: 'Active' }));
      expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(taskList()).getByText('Buy milk')).toBeInTheDocument();
      expect(within(taskList()).queryByText('Walk the dog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
      expect(within(taskList()).queryByText('Buy milk')).not.toBeInTheDocument();
      expect(within(taskList()).getByText('Walk the dog')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      expect(within(taskList()).getAllByRole('listitem')).toHaveLength(2);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('API errors', () => {
    it('shows the error message when loading tasks fails', async () => {
      mockApi({
        'GET /api/tasks': { status: 500, body: { error: { message: 'Database unavailable' } } },
      });
      render(<App />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    });

    it('shows the error message and keeps the list unchanged when adding fails', async () => {
      mockApi({
        'GET /api/tasks': { status: 200, body: [milk] },
        'POST /api/tasks': { status: 500, body: { error: { message: 'Could not save task' } } },
      });
      render(<App />);

      fireEvent.change(await screen.findByRole('textbox', { name: 'New task' }), {
        target: { value: 'Write tests' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save task');
      expect(within(taskList()).getAllByRole('listitem')).toHaveLength(1);
    });
  });
});
