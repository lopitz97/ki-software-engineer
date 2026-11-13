import { expect, Locator, Page, test } from '@playwright/test';
import { given, then, when } from './support/bdd';
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
  await given('an existing book is available', async () => {
    await mockEditableBook(page);
  });
  await when('the reader starts editing from details using the keyboard', async () => {
    await startEditing(page);
  });
  await then('public fields are prefilled and editable while identifiers remain protected', async () => {
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
});

test('saves every editable field by ISBN, returns to details and retains changes after reload', async ({ page }) => {
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
  const api = await given('an existing book is open in its edit form', async () => {
    await page.route(changes.cover, route =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"/>'
      })
    );
    const api = await mockEditableBook(page);
    await startEditing(page);
    return api;
  });
  await when('the reader changes every editable field and saves', async () => {
    await fillFields(page, changes);
    await page.getByRole('button', { name: saveName }).click();
  });
  await then('the changes are saved once by ISBN without altering internal identifiers', async () => {
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
  });
  await when('the reader reloads the book details', async () => {
    await page.reload();
  });
  await then('the saved content is still visible as literal text', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(changes.title);
    for (const value of [changes.subtitle, `By ${changes.author}`, changes.publisher, changes.abstract, book.isbn]) {
      await expect(page.getByText(value, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(String(changes.numPages), { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: `Cover of ${changes.title}` })).toHaveAttribute('src', changes.cover);
    await expect(page.locator('article b')).toHaveCount(0);
  });
  await when('the reader reopens editing', async () => {
    await page.getByRole('button', { name: editName }).click();
  });
  await then('the edit form contains the saved values', async () => {
    await expectFields(page, { ...changes, price: String(api.stored().price) });
  });
});

test('cancels changes without writing and reopens the original values', async ({ page }) => {
  const api = await given('an existing book has unsaved edits', async () => {
    const api = await mockEditableBook(page);
    await startEditing(page);
    await fillFields(page, { title: 'Discard this title', author: 'Discard this author', numPages: 999 });
    return api;
  });
  const cancel = page.getByRole('button', { name: cancelName }).or(page.getByRole('link', { name: cancelName }));
  await when('the reader cancels editing', async () => {
    await cancel.click();
  });
  await then('the original details are restored without saving', async () => {
    await expect(page).toHaveURL(detailsUrl);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    expect(api.writes).toHaveLength(0);
  });
  await when('the reader reopens editing', async () => {
    await page.getByRole('button', { name: editName }).click();
  });
  await then('the original field values are shown', async () => {
    await expectFields(page, book);
  });
});

test('allows clearing optional fields while preserving the required fields and identifiers', async ({ page }) => {
  const emptyFields = { subtitle: '', publisher: '', cover: '', abstract: '', price: '' };
  const api = await given('an existing book is open for editing', async () => {
    const api = await mockEditableBook(page);
    await startEditing(page);
    return api;
  });
  await when('the reader clears every optional field and saves', async () => {
    await fillFields(page, emptyFields);
    await page.getByRole('button', { name: saveName }).click();
  });
  await then('saving preserves required values and identifiers while removing the optional price', async () => {
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
  });
  await when('the reader reloads details and reopens editing', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    await page.getByRole('button', { name: editName }).click();
  });
  await then('the cleared optional fields remain empty', async () => {
    await expectFields(page, emptyFields);
  });
});

for (const field of ['title', 'author', 'numPages'] as const) {
  test(`rejects an empty required ${field} and allows saving after correction`, async ({ page }) => {
    const api = await given('an existing book is open for editing', async () => {
      const api = await mockEditableBook(page);
      await startEditing(page);
      return api;
    });
    const input = page.getByLabel(labels[field], { exact: true });
    const save = page.getByRole('button', { name: saveName });
    await when(`the reader clears the required ${field} and attempts to save`, async () => {
      await input.fill('');
      await input.blur();
      if (await save.isEnabled()) await save.click();
    });
    await then('an accessible validation error prevents saving the empty field', async () => {
      await expectValidationMessage(input);
      await expect(input).toHaveValue('');
      expect(api.writes).toHaveLength(0);
    });
    await when(`the reader corrects ${field} and saves`, async () => {
      await input.fill(String(book[field]));
      await save.click();
    });
    await then('the book is saved once and details replace the form', async () => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
      await expect(page.getByRole('button', { name: saveName })).toHaveCount(0);
      expect(api.writes).toHaveLength(1);
    });
  });
}

for (const field of ['numPages', 'price'] as const) {
  test(`rejects a negative ${field} and accepts zero`, async ({ page }) => {
    const api = await given('an existing book is open for editing', async () => {
      const api = await mockEditableBook(page);
      await startEditing(page);
      return api;
    });
    const input = page.getByLabel(labels[field], { exact: true });
    const save = page.getByRole('button', { name: saveName });
    await when(`the reader enters a negative ${field} and attempts to save`, async () => {
      await input.fill('-1');
      await input.blur();
      if (await save.isEnabled()) await save.click();
    });
    await then('validation rejects the negative value without saving', async () => {
      await expectValidationMessage(input);
      expect(api.writes).toHaveLength(0);
    });
    await when(`the reader corrects ${field} to zero and saves`, async () => {
      await input.fill('0');
      await save.click();
    });
    await then('the saved book contains zero and details replace the form', async () => {
      await expect(page.getByRole('button', { name: saveName })).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
      expect(api.writes).toHaveLength(1);
      expect(Number(api.writes[0].body[field])).toBe(0);
    });
  });
}

test('keeps all draft values on a save failure and saves them when retried', async ({ page }) => {
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
  const api = await given('a book has unsaved edits and saving will fail', async () => {
    const api = await mockEditableBook(page);
    api.failSaving(true);
    await startEditing(page);
    await fillFields(page, changes);
    return api;
  });
  await when('the reader saves the edits', async () => {
    await page.getByRole('button', { name: saveName }).click();
  });
  await then('the failure preserves every draft field and leaves the stored book unchanged', async () => {
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/save|speicher|try again|erneut/i);
    await expectFields(page, changes);
    await expect(page.getByRole('button', { name: saveName })).toBeEnabled();
    expect(api.writes).toHaveLength(1);
    expect(api.stored()).toEqual(book);
  });
  await when('the server recovers and the reader retries saving', async () => {
    api.failSaving(false);
    await page.getByRole('button', { name: saveName }).click();
  });
  await then('the same draft is saved and its details open', async () => {
    await expect(page).toHaveURL(detailsUrl);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(changes.title);
    await expect(page.getByRole('button', { name: saveName })).toHaveCount(0);
    expect(api.writes).toHaveLength(2);
    expect(api.writes[1].body).toEqual(api.writes[0].body);
  });
  await when('the reader reloads details', async () => {
    await page.reload();
  });
  await then('the saved title persists', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(changes.title);
  });
});
