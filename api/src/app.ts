import express from 'express';
import { tasksRouter } from './routes/tasks.js';

export function createApp({ tasksFile }: { tasksFile: string }) {
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', tasksRouter(tasksFile));
  return app;
}

export const app = createApp({ tasksFile: process.env.TASKS_FILE ?? 'data/tasks.json' });
