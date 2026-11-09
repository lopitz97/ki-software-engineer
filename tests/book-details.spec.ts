import { expect, test } from '@playwright/test';
import { apiUrl, appUrl, book, coverUrl, mockBooks } from './support/books';

test('opens details using the keyboard and returns to the collection', async ({ page }) => {
  await mockBooks(page);
  await page.goto(appUrl);
  const link = page.getByRole('link', { name: `View details for ${book.title}` });
  await expect(link).toHaveAttribute('href', '/books/book-1');
  await page.getByRole('textbox').focus();
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${appUrl}/books/book-1`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Back to collection' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${appUrl}/`);
  await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
});

test('supports direct links and refresh, displaying all public fields as text', async ({ page }) => {
  await mockBooks(page);
  await page.goto(`${appUrl}/books/book-1`);
  for (let attempt = 0; attempt < 2; attempt++) {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    for (const value of [
      book.subtitle,
      `By ${book.author}`,
      book.isbn,
      book.publisher,
      String(book.numPages),
      book.price,
      book.abstract
    ]) {
      await expect(page.getByText(value, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('img', { name: `Cover of ${book.title}` })).toBeVisible();
    await expect(page.getByText(book.abstract, { exact: true })).toHaveCSS('white-space', 'pre-line');
    await expect(page.locator('article b')).toHaveCount(0);
    await expect(page.locator('article')).not.toContainText('userId');
    if (attempt === 0) await page.reload();
  }
});

test('omits absent optional text and provides a missing-cover placeholder', async ({ page }) => {
  await mockBooks(page, { ...book, subtitle: undefined, abstract: '', cover: '' });
  await page.goto(`${appUrl}/books/book-1`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  await expect(page.getByText('No cover available')).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByText(book.subtitle)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'About this book' })).toHaveCount(0);
});

test('replaces a failed cover image with a placeholder', async ({ page }) => {
  await mockBooks(page);
  await page.route(coverUrl, route => route.fulfill({ status: 404 }));
  await page.goto(`${appUrl}/books/book-1`);
  await expect(page.getByText('No cover available')).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(0);
});

test('shows loading until the request completes', async ({ page }) => {
  await mockBooks(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route(`${apiUrl}?id=*`, async route => {
    await gate;
    await route.fulfill({ json: [book] });
  });
  try {
    await page.goto(`${appUrl}/books/book-1`);
    await expect(page.getByRole('status')).toHaveText('Loading book...');
    await expect(page.getByRole('link', { name: 'Back to collection' })).toBeVisible();
    await expect(page.locator('article')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
});

for (const response of ['empty', '404'] as const) {
  test(`shows book not found for ${response} responses`, async ({ page }) => {
    await mockBooks(page);
    await page.route(`${apiUrl}?id=*`, route =>
      route.fulfill(response === 'empty' ? { json: [] } : { status: 404, json: { message: 'Not found' } })
    );
    await page.goto(`${appUrl}/books/missing`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book not found');
    await expect(page.getByRole('link', { name: 'Back to collection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  });
}

test('allows retry after a server error', async ({ page }) => {
  await mockBooks(page);
  let requests = 0;
  await page.route(`${apiUrl}?id=*`, route => {
    requests++;
    return route.fulfill(requests === 1 ? { status: 500 } : { json: [book] });
  });
  await page.goto(`${appUrl}/books/book-1`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unable to load book');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  expect(requests).toBe(2);
});

test('encodes special characters in book identifiers', async ({ page }) => {
  const specialBook = { ...book, id: 'book & another? / +' };
  await mockBooks(page, specialBook);
  await page.goto(appUrl);
  const detailsRequest = page.waitForRequest(request => new URL(request.url()).searchParams.has('id'));
  await page.getByRole('link', { name: `View details for ${book.title}` }).click();
  expect(new URL((await detailsRequest).url()).searchParams.get('id')).toBe(specialBook.id);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
});

test('clears stale content and cancels requests when the route identifier changes', async ({ page }) => {
  await mockBooks(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route(`${apiUrl}?id=slow-book`, async route => {
    await gate;
    await route.fulfill({ json: [{ ...book, id: 'slow-book', title: 'Stale book' }] }).catch(() => {});
  });
  await page.goto(`${appUrl}/books/book-1`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  const slowRequest = page.waitForRequest(`${apiUrl}?id=slow-book`);
  const cancelledRequest = page.waitForEvent('requestfailed', request => request.url() === `${apiUrl}?id=slow-book`);
  try {
    // Simulate history navigation between detail URLs without reloading the component.
    await page.evaluate(() => {
      history.pushState({}, '', '/books/slow-book');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await slowRequest;
    await expect(page.getByRole('status')).toHaveText('Loading book...');
    await expect(page.getByText(book.title, { exact: true })).toHaveCount(0);
    await page.evaluate(() => history.back());
    await cancelledRequest;
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  } finally {
    release();
  }
  await expect(page.getByText('Stale book')).toHaveCount(0);
});

for (const width of [390, 1280]) {
  test(`lays out details without horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mockBooks(page);
    await page.goto(`${appUrl}/books/book-1`);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(book.title);
    const cover = await page.getByRole('img').boundingBox();
    const title = await heading.boundingBox();
    expect(cover).not.toBeNull();
    expect(title).not.toBeNull();
    if (width < 768) expect(title!.y).toBeGreaterThanOrEqual(cover!.y + cover!.height);
    else expect(title!.x).toBeGreaterThan(cover!.x + cover!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('details.png'), fullPage: true });
  });
}
