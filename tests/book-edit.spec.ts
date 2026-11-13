import { expect, Locator, Page, test } from '@playwright/test';
import { Book } from '../src/app/books/book';
import { apiUrl, appUrl, book, mockBooks } from './support/books';

// Match the application's English labels or the German terms from the requirements,
// without making a particular translation part of the feature contract.
const labels = {
  title: /^(Title|Titel)$/i,
  subtitle: /^(Subtitle|Untertitel)$/i,
  author: /^(Author|Autor)$/i,
  publisher: /^(Publisher|Verlag)$/i,
  numPages: /^(Pages|Page count|Number of pages|Seiten|Seitenanzahl|Seitenzahl)$/i,
  price: /^(Price|Preis)$/i,
  cover: /^(Cover|Cover URL|Cover-URL)$/i,
  abstract: /^(Abstract|Description|Beschreibung|Zusammenfassung)$/i
};
const editName = /^(Edit|Edit book|Bearbeiten|Buch bearbeiten)$/i;
const saveName = /^(Save|Save changes|Speichern|Änderungen speichern)$/i;
const cancelName = /^(Cancel|Abbrechen)$/i;
const detailsUrl = `${appUrl}/books/${book.id}`;
type EditableField = keyof typeof labels;

async function mockEditableBook(page: Page) {
  await mockBooks(page);
  let stored = { ...book } as Book;
  const writes: { method: string; url: string; body: Record<string, unknown> }[] = [];
  let failSave = false;

  // The cached bookmonkey-api 5.0.1 controller supports PUT and PATCH by ISBN.
  // Model its write boundary separately from the ID-filtered collection read.
  await page.route(
    url => url.origin + url.pathname === apiUrl || (url.origin + url.pathname).startsWith(`${apiUrl}/`),
    async route => {
      const request = route.request();
      const url = new URL(request.url());
      const resource = url.origin + url.pathname;
      if (request.method() === 'GET' && resource === apiUrl) {
        const id = url.searchParams.get('id');
        await route.fulfill({ json: !id || id === stored.id ? [stored] : [] });
        return;
      }
      if (['PUT', 'PATCH'].includes(request.method())) {
        const body = request.postDataJSON() as Record<string, unknown>;
        writes.push({ method: request.method(), url: resource, body });
        if (resource !== `${apiUrl}/${encodeURIComponent(book.isbn)}`) {
          await route.fulfill({ status: 404, json: { message: 'Book not found' } });
          return;
        }
        if (failSave) {
          await route.fulfill({ status: 500, json: { message: 'Unable to save' } });
          return;
        }
        const updated = request.method() === 'PUT' ? body : { ...stored, ...body };
        stored = { ...updated, id: book.id, isbn: book.isbn, userId: book.userId } as Book;
        await route.fulfill({ json: stored });
        return;
      }
      await route.fulfill({ status: 405 });
    }
  );
  return {
    writes,
    stored: () => stored,
    failSaving: (value: boolean) => {
      failSave = value;
    }
  };
}

async function startEditing(page: Page) {
  await page.goto(detailsUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  const edit = page.getByRole('button', { name: editName });
  await expect(edit).toBeVisible();
  await edit.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel(labels.title, { exact: true })).toBeVisible();
}

async function expectFields(page: Page, values: Partial<Record<EditableField, string | number>>) {
  for (const field of Object.keys(labels) as EditableField[]) {
    if (values[field] !== undefined) {
      await expect(page.getByLabel(labels[field], { exact: true })).toHaveValue(String(values[field]));
    }
  }
}

async function fillFields(page: Page, values: Partial<Record<EditableField, string | number>>) {
  for (const [field, value] of Object.entries(values)) {
    await page.getByLabel(labels[field as EditableField], { exact: true }).fill(String(value));
  }
}

async function expectValidationMessage(input: Locator) {
  await expect
    .poll(() =>
      input.evaluate(element => {
        if (element instanceof HTMLInputElement && !element.validity.valid && element.validationMessage) return true;
        if (element.getAttribute('aria-invalid') !== 'true') return false;
        const descriptionIds = [element.getAttribute('aria-describedby'), element.getAttribute('aria-errormessage')]
          .filter(Boolean)
          .join(' ')
          .split(/\s+/);
        return descriptionIds.some(id => document.getElementById(id)?.textContent?.trim());
      })
    )
    .toBe(true);
}

test('starts editing from details with all public fields prefilled and ISBN protected', async ({ page }) => {
  await mockEditableBook(page);
  await startEditing(page);
  await expectFields(page, book);
  for (const field of Object.values(labels)) {
    await expect(page.getByLabel(field, { exact: true })).toBeEditable();
  }
  const isbn = page.getByRole('textbox', { name: /^ISBN$/i });
  if (await isbn.count()) {
    await expect(isbn).toHaveValue(book.isbn);
    await expect(isbn).not.toBeEditable();
  }
  await expect(page.getByLabel(/^(ID|User ID|userId|Benutzer-ID)$/i, { exact: true })).toHaveCount(0);
});

test('saves every editable field by ISBN, returns to details and retains changes after reload', async ({ page }) => {
  const api = await mockEditableBook(page);
  const changes = {
    title: 'An Updated Book',
    subtitle: 'A revised subtitle',
    author: 'Grace Writer',
    publisher: 'Updated Press',
    numPages: 456,
    price: '24.50',
    cover: `${appUrl}/test-updated-cover.svg`,
    abstract: 'Updated description.\nAnother line with <b>literal text</b>.'
  };
  await page.route(changes.cover, route =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"/>'
    })
  );
  await startEditing(page);
  await fillFields(page, changes);
  await page.getByRole('button', { name: saveName }).click();
  await expect(page).toHaveURL(detailsUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(changes.title);
  await expect(page.getByRole('button', { name: saveName })).toHaveCount(0);
  expect(api.writes).toHaveLength(1);
  expect(api.writes[0].url).toBe(`${apiUrl}/${book.isbn}`);
  for (const [field, value] of Object.entries(changes)) {
    // Existing responses use string prices; API v5 write inputs use numbers.
    if (field === 'price') expect(Number(api.writes[0].body[field])).toBe(Number(value));
    else expect(api.writes[0].body[field]).toBe(value);
  }
  expect(api.stored()).toMatchObject({ id: book.id, isbn: book.isbn, userId: book.userId });
  for (const field of ['id', 'isbn', 'userId'] as const) {
    if (field in api.writes[0].body) expect(api.writes[0].body[field]).toBe(book[field]);
  }
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(changes.title);
  for (const value of [changes.subtitle, `By ${changes.author}`, changes.publisher, changes.abstract, book.isbn]) {
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(String(changes.numPages), { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: `Cover of ${changes.title}` })).toHaveAttribute('src', changes.cover);
  await expect(page.locator('article b')).toHaveCount(0);
  await page.getByRole('button', { name: editName }).click();
  await expectFields(page, { ...changes, price: String(api.stored().price) });
});

test('cancels changes without writing and reopens the original values', async ({ page }) => {
  const api = await mockEditableBook(page);
  await startEditing(page);
  await fillFields(page, { title: 'Discard this title', author: 'Discard this author', numPages: 999 });
  const cancel = page.getByRole('button', { name: cancelName }).or(page.getByRole('link', { name: cancelName }));
  await cancel.click();
  await expect(page).toHaveURL(detailsUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  expect(api.writes).toHaveLength(0);
  await page.getByRole('button', { name: editName }).click();
  await expectFields(page, book);
});

test('allows clearing optional fields while preserving the required fields and identifiers', async ({ page }) => {
  const api = await mockEditableBook(page);
  const emptyFields = { subtitle: '', publisher: '', cover: '', abstract: '', price: '' };
  await startEditing(page);
  await fillFields(page, emptyFields);
  await page.getByRole('button', { name: saveName }).click();
  await expect(page.getByRole('button', { name: saveName })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  expect(api.writes).toHaveLength(1);
  expect(api.stored()).toMatchObject({
    title: book.title,
    author: book.author,
    numPages: book.numPages,
    isbn: book.isbn,
    id: book.id,
    userId: book.userId
  });
  expect(api.stored().price).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  await page.getByRole('button', { name: editName }).click();
  await expectFields(page, emptyFields);
});

for (const field of ['title', 'author', 'numPages'] as const) {
  test(`rejects an empty required ${field} and allows saving after correction`, async ({ page }) => {
    const api = await mockEditableBook(page);
    await startEditing(page);
    const input = page.getByLabel(labels[field], { exact: true });
    await input.fill('');
    await input.blur();
    const save = page.getByRole('button', { name: saveName });
    if (await save.isEnabled()) await save.click();
    // Accept a native message or an accessible custom error associated with the field.
    await expectValidationMessage(input);
    await expect(input).toHaveValue('');
    expect(api.writes).toHaveLength(0);
    await input.fill(String(book[field]));
    await save.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    await expect(page.getByRole('button', { name: saveName })).toHaveCount(0);
    expect(api.writes).toHaveLength(1);
  });
}

for (const field of ['numPages', 'price'] as const) {
  test(`rejects a negative ${field} and accepts zero`, async ({ page }) => {
    const api = await mockEditableBook(page);
    await startEditing(page);
    const input = page.getByLabel(labels[field], { exact: true });
    await input.fill('-1');
    await input.blur();
    const save = page.getByRole('button', { name: saveName });
    if (await save.isEnabled()) await save.click();
    await expectValidationMessage(input);
    expect(api.writes).toHaveLength(0);
    await input.fill('0');
    await save.click();
    await expect(page.getByRole('button', { name: saveName })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    expect(api.writes).toHaveLength(1);
    expect(Number(api.writes[0].body[field])).toBe(0);
  });
}

test('keeps all draft values on a save failure and saves them when retried', async ({ page }) => {
  const api = await mockEditableBook(page);
  api.failSaving(true);
  const changes = {
    title: 'Keep this title',
    subtitle: 'Keep this subtitle',
    author: 'Keep this author',
    publisher: 'Keep this publisher',
    numPages: 512,
    price: '27.95',
    cover: book.cover,
    abstract: 'Keep this description.\nIncluding this line.'
  };
  await startEditing(page);
  await fillFields(page, changes);
  await page.getByRole('button', { name: saveName }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/save|speicher|try again|erneut/i);
  await expectFields(page, changes);
  await expect(page.getByRole('button', { name: saveName })).toBeEnabled();
  expect(api.writes).toHaveLength(1);
  expect(api.stored()).toEqual(book);
  api.failSaving(false);
  await page.getByRole('button', { name: saveName }).click();
  await expect(page).toHaveURL(detailsUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(changes.title);
  await expect(page.getByRole('button', { name: saveName })).toHaveCount(0);
  expect(api.writes).toHaveLength(2);
  expect(api.writes[1].body).toEqual(api.writes[0].body);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(changes.title);
});
