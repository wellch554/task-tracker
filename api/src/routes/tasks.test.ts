import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

let dir: string;
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tasks-api-'));
  const app = createApp({ tasksFile: join(dir, 'tasks.json') });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(dir, { recursive: true, force: true });
});

function request(method: string, path: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createTask(body: Record<string, unknown>) {
  const res = await request('POST', '/api/tasks', body);
  expect(res.status).toBe(201);
  return res.json();
}

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('POST /api/tasks', () => {
  it('creates a task with defaults', async () => {
    const res = await request('POST', '/api/tasks', { title: '  Buy milk  ' });

    expect(res.status).toBe(201);
    const task = await res.json();
    expect(task).toEqual({
      id: expect.any(String),
      title: 'Buy milk',
      completed: false,
      priority: 'medium',
      dueDate: null,
      createdAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false);
  });

  it('accepts priority and dueDate', async () => {
    const task = await createTask({ title: 'File taxes', priority: 'high', dueDate: '2026-11-01' });

    expect(task).toMatchObject({ priority: 'high', dueDate: '2026-11-01' });
  });

  it.each([
    ['an empty title', { title: '' }],
    ['a whitespace-only title', { title: '   ' }],
    ['a missing title', {}],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await request('POST', '/api/tasks', body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: expect.objectContaining({ message: expect.any(String) }) });
  });
});

describe('GET /api/tasks', () => {
  it('returns an empty list when there are no tasks', async () => {
    const res = await request('GET', '/api/tasks');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('lists created tasks', async () => {
    const a = await createTask({ title: 'First' });
    const b = await createTask({ title: 'Second' });

    const res = await request('GET', '/api/tasks');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([a, b]);
  });

  describe('filter by status', () => {
    let active: { id: string };
    let done: { id: string };

    beforeEach(async () => {
      active = await createTask({ title: 'Still to do' });
      done = await createTask({ title: 'Already done' });
      const res = await request('PATCH', `/api/tasks/${done.id}`, { completed: true });
      expect(res.status).toBe(200);
    });

    it.each([
      ['active', () => [active.id]],
      ['completed', () => [done.id]],
      ['all', () => [active.id, done.id]],
    ])('?status=%s returns matching tasks', async (status, expectedIds) => {
      const res = await request('GET', `/api/tasks?status=${status}`);

      expect(res.status).toBe(200);
      const tasks: { id: string }[] = await res.json();
      expect(tasks.map((t) => t.id)).toEqual(expectedIds());
    });

    it('rejects an unknown status with 400', async () => {
      const res = await request('GET', '/api/tasks?status=bogus');

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: expect.objectContaining({ message: expect.any(String) }) });
    });
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('marks a task completed', async () => {
    const task = await createTask({ title: 'Walk dog' });

    const res = await request('PATCH', `/api/tasks/${task.id}`, { completed: true });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...task, completed: true });

    const list = await (await request('GET', '/api/tasks')).json();
    expect(list).toEqual([{ ...task, completed: true }]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request('PATCH', `/api/tasks/${UNKNOWN_ID}`, { completed: true });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: expect.objectContaining({ message: expect.any(String) }) });
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task', async () => {
    const keep = await createTask({ title: 'Keep me' });
    const remove = await createTask({ title: 'Delete me' });

    const res = await request('DELETE', `/api/tasks/${remove.id}`);

    expect(res.status).toBe(204);
    expect(await (await request('GET', '/api/tasks')).json()).toEqual([keep]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request('DELETE', `/api/tasks/${UNKNOWN_ID}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: expect.objectContaining({ message: expect.any(String) }) });
  });
});
