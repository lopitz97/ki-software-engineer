import { expect, test } from '@playwright/test';
import { apiUrl, book, coverUrl, mockBooks } from './support/books';

test('redirects an unknown URL to the lazy-loaded collection and opens details', async ({ page }) => {
  await mockBooks(page);
  await page.goto('/unknown-page');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book Collection');
  await page.getByRole('link', { name: `View details for ${book.title}` }).click();
  await expect(page).toHaveURL(`/books/${book.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  await page.getByRole('link', { name: 'Back to collection' }).click();
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
});

test('renders cards without optional text and keeps their detail link accessible', async ({ page }) => {
  await mockBooks(page, { ...book, subtitle: undefined, isbn: '' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await expect(page.getByText(book.subtitle, { exact: true })).toHaveCount(0);
  await expect(page.getByText('ISBN:', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: `View details for ${book.title}` })).toHaveAttribute(
    'href',
    `/books/${book.id}`
  );
});

test('distinguishes an initial failure from empty results and retries', async ({ page }) => {
  await mockBooks(page);
  let requests = 0;
  await page.route(`${apiUrl}?*`, route => {
    requests++;
    return route.fulfill(requests === 1 ? { status: 500 } : { json: [book] });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText('Unable to load books. Please try again.');
  await expect(page.getByText('No books available')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  expect(requests).toBe(2);
});

test('shows successful empty states for collection and search', async ({ page }) => {
  await page.route(`${apiUrl}?*`, route => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('No books available');
  await page.getByRole('textbox', { name: 'Search books' }).fill('missing');
  await expect(page.getByRole('status')).toHaveText('No books match your search');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('failed searches hide old results, retry the query, and allow later searches', async ({ page }) => {
  await mockBooks(page);
  const queries: (string | null)[] = [];
  await page.route(`${apiUrl}?*`, route => {
    const query = new URL(route.request().url()).searchParams.get('q');
    queries.push(query);
    return route.fulfill(
      query === 'broken' && queries.filter(value => value === query).length === 1
        ? { status: 500 }
        : { json: [{ ...book, title: query || book.title }] }
    );
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Search books' });
  await input.fill('broken');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'broken', exact: true })).toBeVisible();
  await input.fill('recovered');
  await expect(page.getByRole('heading', { name: 'recovered', exact: true })).toBeVisible();
  expect(queries).toEqual([null, 'broken', 'broken', 'recovered']);
});

test('debounces typing and clears once immediately with keyboard accessible controls', async ({ page }) => {
  await page.clock.install();
  await mockBooks(page);
  const queries: (string | null)[] = [];
  page.on('request', request => {
    if (request.url().startsWith(`${apiUrl}?`)) queries.push(new URL(request.url()).searchParams.get('q'));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const input = page.getByRole('textbox', { name: 'Search books' });
  await expect(input).toBeFocused();
  await expect(input).toHaveCSS('outline-style', 'solid');
  await input.fill('pending');
  await page.clock.runFor(100);
  expect(queries).toEqual([null]);
  await page.keyboard.press('Tab');
  const clear = page.getByRole('button', { name: 'Clear search', exact: true });
  await expect(clear).toBeFocused();
  await expect(clear).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await page.clock.runFor(1000);
  expect(queries).toEqual([null, null]);
});

test('cancels stale requests immediately and preserves the latest results', async ({ page }) => {
  await page.clock.install();
  await mockBooks(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route(`${apiUrl}?*`, async route => {
    const query = new URL(route.request().url()).searchParams.get('q');
    if (query === 'slow') await gate;
    await route.fulfill({ json: [{ ...book, title: query || book.title }] }).catch(() => {});
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Search books' });
  const slowRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'slow');
  await input.fill('slow');
  await page.clock.runFor(300);
  await slowRequest;
  const cancelled = page.waitForEvent(
    'requestfailed',
    request => new URL(request.url()).searchParams.get('q') === 'slow'
  );
  try {
    await input.fill('latest');
    await cancelled;
    await expect(page.getByRole('status')).toHaveText('Loading books...');
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toHaveCount(0);
    await page.clock.runFor(300);
    await expect(page.getByRole('heading', { name: 'latest', exact: true })).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { name: 'slow', exact: true })).toHaveCount(0);
});

test('destroys pending debounce when navigating away', async ({ page }) => {
  await page.clock.install();
  await mockBooks(page);
  const searchRequests: string[] = [];
  page.on('request', request => {
    if (request.url().startsWith(`${apiUrl}?`) && new URL(request.url()).searchParams.has('q')) {
      searchRequests.push(request.url());
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search books' }).fill('pending');
  await page.evaluate(() => {
    history.pushState({}, '', '/books/book-1');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  await page.clock.runFor(1000);
  expect(searchRequests).toEqual([]);
});

for (const cover of ['', coverUrl]) {
  test(`collection uses a placeholder for ${cover ? 'broken' : 'missing'} covers`, async ({ page }) => {
    await mockBooks(page, { ...book, cover });
    await page.route(coverUrl, route => route.fulfill({ status: 404 }));
    await page.goto('/');
    await expect(page.getByText('No cover available')).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
  });
}

test('a failed cover does not carry over to the next detail route', async ({ page }) => {
  await mockBooks(page);
  const validCover = `${coverUrl}?valid`;
  await page.route(coverUrl, route => route.fulfill({ status: 404 }));
  await page.route(validCover, route =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"/>'
    })
  );
  await page.route(`${apiUrl}?id=*`, route => {
    const id = new URL(route.request().url()).searchParams.get('id');
    return route.fulfill({ json: [{ ...book, id, cover: id === 'next' ? validCover : coverUrl }] });
  });
  await page.goto('/books/book-1');
  await expect(page.getByText('No cover available')).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, '', '/books/next');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('img', { name: `Cover of ${book.title}` })).toBeVisible();
  await expect(page.getByText('No cover available')).toHaveCount(0);
});
