import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Router, type Response } from 'express';

type Priority = 'low' | 'medium' | 'high';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
}

const STATUSES = ['all', 'active', 'completed'];

function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ error: { message } });
}

export function tasksRouter(tasksFile: string) {
  let tasks: Task[] | undefined;
  let writes = Promise.resolve();

  async function load(): Promise<Task[]> {
    if (!tasks) {
      try {
        tasks = JSON.parse(await readFile(tasksFile, 'utf8')) as Task[];
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        tasks = [];
      }
    }
    return tasks;
  }

  // Writes are queued so concurrent requests can't interleave, and each
  // write goes to a temp file first so a crash never leaves a partial file.
  function save(): Promise<void> {
    const data = JSON.stringify(tasks, null, 2);
    writes = writes.then(async () => {
      await mkdir(dirname(tasksFile), { recursive: true });
      await writeFile(`${tasksFile}.tmp`, data);
      await rename(`${tasksFile}.tmp`, tasksFile);
    });
    return writes;
  }

  const router = Router();

  router.get('/', async (req, res) => {
    const status = req.query.status ?? 'all';
    if (typeof status !== 'string' || !STATUSES.includes(status)) {
      return sendError(res, 400, 'status must be one of: all, active, completed');
    }
    const all = await load();
    res.json(status === 'all' ? all : all.filter((t) => t.completed === (status === 'completed')));
  });

  router.post('/', async (req, res) => {
    const { title, priority = 'medium', dueDate = null } = req.body ?? {};
    if (typeof title !== 'string' || title.trim() === '') {
      return sendError(res, 400, 'title is required');
    }
    const task: Task = {
      id: randomUUID(),
      title: title.trim(),
      completed: false,
      priority,
      dueDate,
      createdAt: new Date().toISOString(),
    };
    (await load()).push(task);
    await save();
    res.status(201).json(task);
  });

  router.patch('/:id', async (req, res) => {
    const task = (await load()).find((t) => t.id === req.params.id);
    if (!task) return sendError(res, 404, 'task not found');
    if (typeof req.body?.completed === 'boolean') task.completed = req.body.completed;
    await save();
    res.json(task);
  });

  router.delete('/:id', async (req, res) => {
    const all = await load();
    const index = all.findIndex((t) => t.id === req.params.id);
    if (index === -1) return sendError(res, 404, 'task not found');
    all.splice(index, 1);
    await save();
    res.status(204).end();
  });

  return router;
}
