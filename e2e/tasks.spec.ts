import { expect, test, type Page } from '@playwright/test';

// The API has no reset endpoint, so clear its data by deleting every task.
test.beforeEach(async ({ request, page }) => {
  const res = await request.get('/api/tasks');
  for (const task of (await res.json()) as { id: string }[]) {
    expect((await request.delete(`/api/tasks/${task.id}`)).ok()).toBe(true);
  }
  await page.goto('/');
  await expect(page.getByText('No tasks yet')).toBeVisible();
});

async function addTask(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'New task' }).fill(title);
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(taskList(page).getByRole('checkbox', { name: title })).toBeVisible();
}

// Completion isn't optimistic: the checkbox flips only after the API responds,
// so tests click and then wait on toBeChecked() rather than using check().
function taskList(page: Page) {
  return page.getByRole('list', { name: 'Tasks' });
}

test('adds a task', async ({ page }) => {
  await addTask(page, 'Buy milk');

  await expect(taskList(page).getByRole('listitem')).toHaveCount(1);
  await expect(taskList(page).getByRole('checkbox', { name: 'Buy milk' })).not.toBeChecked();
  await expect(page.getByRole('textbox', { name: 'New task' })).toHaveValue('');
  await expect(page.getByText('No tasks yet')).toBeHidden();
});

test('completes a task', async ({ page }) => {
  await addTask(page, 'Buy milk');

  await taskList(page).getByRole('checkbox', { name: 'Buy milk' }).click();

  await expect(taskList(page).getByRole('checkbox', { name: 'Buy milk' })).toBeChecked();
});

test('deletes a task', async ({ page }) => {
  await addTask(page, 'Buy milk');
  await addTask(page, 'Walk dog');

  await page.getByRole('button', { name: 'Delete Buy milk' }).click();

  await expect(taskList(page).getByRole('checkbox', { name: 'Buy milk' })).toHaveCount(0);
  await expect(taskList(page).getByRole('checkbox', { name: 'Walk dog' })).toBeVisible();
});

test('filters tasks by status', async ({ page }) => {
  await addTask(page, 'Buy milk');
  await addTask(page, 'Walk dog');
  await taskList(page).getByRole('checkbox', { name: 'Walk dog' }).click();
  await expect(taskList(page).getByRole('checkbox', { name: 'Walk dog' })).toBeChecked();

  const list = taskList(page);

  await page.getByRole('button', { name: 'Active' }).click();
  await expect(page.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByRole('checkbox', { name: 'Buy milk' })).toBeVisible();

  await page.getByRole('button', { name: 'Completed' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByRole('checkbox', { name: 'Walk dog' })).toBeVisible();

  await page.getByRole('button', { name: 'All' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
});

test('keeps tasks after a page reload', async ({ page }) => {
  await addTask(page, 'Buy milk');
  await addTask(page, 'Walk dog');
  await taskList(page).getByRole('checkbox', { name: 'Walk dog' }).click();
  await expect(taskList(page).getByRole('checkbox', { name: 'Walk dog' })).toBeChecked();

  await page.reload();

  await expect(taskList(page).getByRole('listitem')).toHaveCount(2);
  await expect(taskList(page).getByRole('checkbox', { name: 'Buy milk' })).not.toBeChecked();
  await expect(taskList(page).getByRole('checkbox', { name: 'Walk dog' })).toBeChecked();
});
