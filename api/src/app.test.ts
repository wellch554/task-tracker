import { describe, expect, it } from 'vitest';
import { app } from './app.js';

describe('app', () => {
  it('creates an Express app', () => {
    expect(app).toBeDefined();
  });
});
