import { expect, Locator, Page, test } from '@playwright/test';
import { apiUrl, appUrl, book, coverUrl, mockBooks } from './support/books';

const fieldLabels = {
  isbn: /^ISBN$/i,
  title: /^Title$/i,
  subtitle: /^Subtitle$/i,
  author: /^Author$/i,
  publisher: /^Publisher$/i,
  numPages: /^(Pages|Page count|Number of pages)$/i,
  price: /^Price$/i,
  cover: /^(Cover|Cover URL)$/i,
  abstract: /^(Abstract|Description)$/i
};
const addName = /^(Add book|Create book|New book)$/i;
const saveName = /^(Save|Create|Create book|Add book)$/i;
const createdId = '5fcbb83e-2e27-4cb4-b9d0-e8805b840f70';
const draft = {
  isbn: '9789876543210',
  title: 'A Newly Created Book',
  subtitle: 'A new subtitle',
  author: 'New Author',
  publisher: 'New Press',
  numPages: 234,
  price: 12.5,
  cover: coverUrl,
  abstract: 'A new description.\nWith <b>literal text</b>.'
};
type Field = keyof typeof fieldLabels;

async function mockCreation(page: Page) {
  await mockBooks(page);
  const stored: Record<string, unknown>[] = [{ ...book }];
  const writes: Record<string, unknown>[] = [];
  let fail = false;
  await page.route(
    url => url.origin + url.pathname === apiUrl,
    async route => {
      const request = route.request();
      if (request.method() === 'GET') {
        const id = new URL(request.url()).searchParams.get('id');
        const result = id ? stored.filter(item => item['id'] === id) : stored;
        await route.fulfill({ json: result, headers: { 'X-Total-Count': String(result.length) } });
        return;
      }
      if (request.method() !== 'POST') {
        await route.fulfill({ status: 405 });
        return;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      writes.push(body);
      if (fail) {
        await route.fulfill({ status: 500, json: 'Unable to create book' });
        return;
      }
      if (stored.some(item => item['isbn'] === body['isbn'])) {
        await route.fulfill({ status: 409, json: `Book with ISBN ${body['isbn']} already exists` });
        return;
      }
      const created = {
        ...body,
        id: createdId,
        currency: 'EUR',
        createdAt: '2026-11-13T12:00:00.000Z',
        updatedAt: '2026-11-13T12:00:00.000Z'
      };
      stored.push(created);
      await route.fulfill({ status: 201, json: created });
    }
  );
  return {
    writes,
    stored,
    failSaving: (value: boolean) => {
      fail = value;
    }
  };
}

async function openCreation(page: Page) {
  await page.goto(appUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book Collection');
  const add = page.getByRole('link', { name: addName }).or(page.getByRole('button', { name: addName }));
  await expect(add).toBeVisible();
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel(fieldLabels.isbn, { exact: true })).toBeVisible();
}

async function fillDraft(page: Page, values: Partial<Record<Field, string | number>> = draft) {
  for (const [key, value] of Object.entries(values)) {
    await page.getByLabel(fieldLabels[key as Field], { exact: true }).fill(String(value));
  }
}

async function expectInvalid(input: Locator) {
  await expect
    .poll(() =>
      input.evaluate(element => {
        if (element instanceof HTMLInputElement && !element.validity.valid && element.validationMessage) return true;
        if (element.getAttribute('aria-invalid') !== 'true') return false;
        return [element.getAttribute('aria-describedby'), element.getAttribute('aria-errormessage')]
          .filter(Boolean)
          .join(' ')
          .split(/\s+/)
          .some(id => document.getElementById(id)?.textContent?.trim());
      })
    )
    .toBe(true);
}

test('opens a blank creation form from the collection using the keyboard', async ({ page }) => {
  await mockCreation(page);
  await openCreation(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/add|create|new/i);
  for (const label of Object.values(fieldLabels)) {
    const input = page.getByLabel(label, { exact: true });
    await expect(input).toBeEditable();
    await expect(input).toHaveValue('');
  }
  await expect(page.getByLabel(/^(ID|User ID|userId)$/i, { exact: true })).toHaveCount(0);
});

test('creates all entered book fields once and opens the returned ID detail page with reload persistence', async ({
  page
}) => {
  const api = await mockCreation(page);
  await openCreation(page);
  await fillDraft(page);
  await page.getByRole('button', { name: saveName }).click();
  await expect(page).toHaveURL(`${appUrl}/books/${createdId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(draft.title);
  expect(api.writes).toHaveLength(1);
  expect(api.writes[0]).toEqual(draft);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(draft.title);
  for (const value of [draft.subtitle, `By ${draft.author}`, draft.publisher, draft.abstract, draft.isbn]) {
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(String(draft.numPages), { exact: true })).toBeVisible();
  await expect(page.getByText(String(draft.price), { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: `Cover of ${draft.title}` })).toHaveAttribute('src', draft.cover);
  await expect(page.locator('article b')).toHaveCount(0);
});

test('creates with only ISBN, title, author and pages while optional inputs remain empty', async ({ page }) => {
  const api = await mockCreation(page);
  await openCreation(page);
  await fillDraft(page, { isbn: draft.isbn, title: draft.title, author: draft.author, numPages: 0 });
  await page.getByRole('button', { name: saveName }).click();
  await expect(page).toHaveURL(`${appUrl}/books/${createdId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(draft.title);
  expect(api.writes).toHaveLength(1);
  expect(api.writes[0]).toMatchObject({ isbn: draft.isbn, title: draft.title, author: draft.author, numPages: 0 });
  expect(api.writes[0]).not.toHaveProperty('price');
  expect(api.writes[0]).not.toHaveProperty('id');
  expect(api.writes[0]).not.toHaveProperty('userId');
});

test('cancels an entered draft without creating a book and returns to the collection', async ({ page }) => {
  const api = await mockCreation(page);
  await openCreation(page);
  await fillDraft(page);
  await page.getByRole('button', { name: /^Cancel$/i }).click();
  await expect(page).toHaveURL(`${appUrl}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book Collection');
  expect(api.writes).toHaveLength(0);
  expect(api.stored).toHaveLength(1);
  await openCreation(page);
  await expect(page.getByLabel(fieldLabels.title, { exact: true })).toHaveValue('');
});

for (const field of ['isbn', 'title', 'author', 'numPages'] as const) {
  test(`requires ${field} before creating and allows correction`, async ({ page }) => {
    const api = await mockCreation(page);
    await openCreation(page);
    await fillDraft(page);
    const input = page.getByLabel(fieldLabels[field], { exact: true });
    await input.fill('');
    await input.blur();
    const save = page.getByRole('button', { name: saveName });
    if (await save.isEnabled()) await save.click();
    await expectInvalid(input);
    expect(api.writes).toHaveLength(0);
    await input.fill(String(draft[field]));
    await save.click();
    await expect(page).toHaveURL(`${appUrl}/books/${createdId}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(draft.title);
    expect(api.writes).toHaveLength(1);
  });
}

for (const field of ['numPages', 'price'] as const) {
  test(`rejects negative ${field} and accepts zero when creating`, async ({ page }) => {
    const api = await mockCreation(page);
    await openCreation(page);
    await fillDraft(page);
    const input = page.getByLabel(fieldLabels[field], { exact: true });
    await input.fill('-1');
    await input.blur();
    const save = page.getByRole('button', { name: saveName });
    if (await save.isEnabled()) await save.click();
    await expectInvalid(input);
    expect(api.writes).toHaveLength(0);
    await input.fill('0');
    await save.click();
    await expect(page).toHaveURL(`${appUrl}/books/${createdId}`);
    expect(api.writes).toHaveLength(1);
    expect(api.writes[0][field]).toBe(0);
  });
}

test('retains every input after a server failure and creates the same draft on retry', async ({ page }) => {
  const api = await mockCreation(page);
  api.failSaving(true);
  await openCreation(page);
  await fillDraft(page);
  const save = page.getByRole('button', { name: saveName });
  await save.click();
  await expect(page.getByRole('alert')).toContainText(/save|create|try again/i);
  for (const [field, value] of Object.entries(draft)) {
    await expect(page.getByLabel(fieldLabels[field as Field], { exact: true })).toHaveValue(String(value));
  }
  expect(api.stored).toHaveLength(1);
  expect(api.writes).toHaveLength(1);
  api.failSaving(false);
  await save.click();
  await expect(page).toHaveURL(`${appUrl}/books/${createdId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(draft.title);
  expect(api.writes).toHaveLength(2);
  expect(api.writes[1]).toEqual(api.writes[0]);
});

test('explains a duplicate ISBN, preserves the draft and allows correcting the ISBN', async ({ page }) => {
  const api = await mockCreation(page);
  await openCreation(page);
  await fillDraft(page, { ...draft, isbn: book.isbn });
  const save = page.getByRole('button', { name: saveName });
  await save.click();
  await expect(page.getByRole('alert')).toContainText(/ISBN/i);
  await expect(page.getByRole('alert')).toContainText(/already|exists|duplicate/i);
  await expect(page.getByLabel(fieldLabels.title, { exact: true })).toHaveValue(draft.title);
  await expect(page.getByLabel(fieldLabels.isbn, { exact: true })).toHaveValue(book.isbn);
  expect(api.stored).toHaveLength(1);
  await page.getByLabel(fieldLabels.isbn, { exact: true }).fill(draft.isbn);
  await save.click();
  await expect(page).toHaveURL(`${appUrl}/books/${createdId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(draft.title);
  expect(api.writes).toHaveLength(2);
  expect(api.stored).toHaveLength(2);
});

for (const field of ['isbn', 'title', 'author'] as const) {
  test(`rejects whitespace-only ${field} and accepts corrected text`, async ({ page }) => {
    const api = await mockCreation(page);
    await openCreation(page);
    await fillDraft(page);
    const input = page.getByLabel(fieldLabels[field], { exact: true });
    await input.fill('   ');
    await page.getByRole('button', { name: saveName }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription(/required.*text/i);
    expect(api.writes).toHaveLength(0);
    await input.fill(draft[field]);
    await page.getByRole('button', { name: saveName }).click();
    await expect(page).toHaveURL(`${appUrl}/books/${createdId}`);
    expect(api.writes).toHaveLength(1);
  });
}

test('marks untouched required fields on submit and retains the blank draft', async ({ page }) => {
  const api = await mockCreation(page);
  await openCreation(page);
  await page.getByRole('button', { name: saveName }).click();
  for (const field of ['isbn', 'title', 'author', 'numPages'] as const) {
    const input = page.getByLabel(fieldLabels[field], { exact: true });
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription(/required/i);
  }
  expect(api.writes).toHaveLength(0);
});

test('rejects fractional pages while accepting a fractional price', async ({ page }) => {
  const api = await mockCreation(page);
  await openCreation(page);
  await fillDraft(page, { ...draft, numPages: 1.5 });
  const pages = page.getByLabel(fieldLabels.numPages, { exact: true });
  await page.getByRole('button', { name: saveName }).click();
  await expect(pages).toHaveAttribute('aria-invalid', 'true');
  await expect(pages).toHaveAccessibleDescription(/whole number/i);
  expect(api.writes).toHaveLength(0);
  await pages.fill('2');
  await page.getByRole('button', { name: saveName }).click();
  await expect(page).toHaveURL(`${appUrl}/books/${createdId}`);
  expect(api.writes[0]).toMatchObject({ numPages: 2, price: draft.price });
});

test('disables fields and actions while saving and restores the draft after failure', async ({ page }) => {
  await mockCreation(page);
  let release!: () => void;
  const response = new Promise<void>(resolve => {
    release = resolve;
  });
  let writes = 0;
  await page.route(
    url => url.origin + url.pathname === apiUrl,
    async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      writes++;
      await response;
      await route.fulfill({ status: 500, json: 'Unable to create book' });
    }
  );
  await openCreation(page);
  await fillDraft(page);
  const save = page.getByRole('button', { name: saveName });
  await save.click();
  await expect(page.getByRole('status')).toHaveText('Saving book...');
  for (const label of Object.values(fieldLabels)) {
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  }
  await expect(save).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Cancel$/i })).toBeDisabled();
  await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(writes).toBe(1);
  for (const [field, value] of Object.entries(draft)) {
    const input = page.getByLabel(fieldLabels[field as Field], { exact: true });
    await expect(input).toBeEditable();
    await expect(input).toHaveValue(String(value));
  }
  await expect(save).toBeEnabled();
});
