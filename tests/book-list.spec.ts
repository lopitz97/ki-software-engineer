import { expect, test } from '@playwright/test';
import { given, then, when } from './support/bdd';
import { apiUrl, book, coverUrl, mockBooks } from './support/books';

test('redirects an unknown URL to the lazy-loaded collection and opens details', async ({ page }) => {
  await given('a book is available in the collection', async () => {
    await mockBooks(page);
  });
  await when('the reader visits an unknown URL', async () => {
    await page.goto('/unknown-page');
  });
  await then('the application redirects to the collection', async () => {
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book Collection');
  });
  await when('the reader selects a book', async () => {
    await page.getByRole('link', { name: `View details for ${book.title}` }).click();
  });
  await then('the selected book details are shown', async () => {
    await expect(page).toHaveURL(`/books/${book.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  });
  await when('the reader returns to the collection', async () => {
    await page.getByRole('link', { name: 'Back to collection' }).click();
  });
  await then('the book is listed again', async () => {
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  });
});

test('renders cards without optional text and keeps their detail link accessible', async ({ page }) => {
  await given('a listed book has no subtitle or ISBN', async () => {
    await mockBooks(page, { ...book, subtitle: undefined, isbn: '' });
  });
  await when('the reader opens the collection', async () => {
    await page.goto('/');
  });
  await then('the card omits missing text but retains an accessible detail link', async () => {
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
    await expect(page.getByText(book.subtitle, { exact: true })).toHaveCount(0);
    await expect(page.getByText('ISBN:', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('link', { name: `View details for ${book.title}` })).toHaveAttribute(
      'href',
      `/books/${book.id}`
    );
  });
});

test('distinguishes an initial failure from empty results and retries', async ({ page }) => {
  let requests = 0;
  await given('the initial collection request fails once', async () => {
    await mockBooks(page);
    await page.route(`${apiUrl}?*`, route => {
      requests++;
      return route.fulfill(requests === 1 ? { status: 500 } : { json: [book] });
    });
  });
  await when('the reader opens the collection', async () => {
    await page.goto('/');
  });
  await then('an error is shown instead of a successful empty state', async () => {
    await expect(page.getByRole('alert')).toHaveText('Unable to load books. Please try again.');
    await expect(page.getByText('No books available')).toHaveCount(0);
  });
  await when('the reader retries loading', async () => {
    await page.getByRole('button', { name: 'Retry' }).click();
  });
  await then('a second request displays the collection', async () => {
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
    expect(requests).toBe(2);
  });
});

test('shows successful empty states for collection and search', async ({ page }) => {
  await given('collection and search requests return no books', async () => {
    await page.route(`${apiUrl}?*`, route => route.fulfill({ json: [] }));
  });
  await when('the reader opens the collection', async () => {
    await page.goto('/');
  });
  await then('the empty collection is announced', async () => {
    await expect(page.getByRole('status')).toHaveText('No books available');
  });
  await when('the reader searches for a missing book', async () => {
    await page.getByRole('textbox', { name: 'Search catalogue' }).fill('missing');
  });
  await then('no matches are announced without an error alert', async () => {
    await expect(page.getByRole('status')).toHaveText('No books match your search');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test('failed searches hide old results, retry the query, and allow later searches', async ({ page }) => {
  const queries: (string | null)[] = [];
  await given('the collection is loaded and the next search will fail once', async () => {
    await mockBooks(page);
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
  });
  const input = page.getByRole('textbox', { name: 'Search catalogue' });
  await when('the reader submits the failing search', async () => {
    await input.fill('broken');
  });
  await then('an error replaces the previous results', async () => {
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toHaveCount(0);
  });
  await when('the reader retries the search', async () => {
    await page.getByRole('button', { name: 'Retry' }).click();
  });
  await then('the same query returns matching results', async () => {
    await expect(page.getByRole('heading', { name: 'broken', exact: true })).toBeVisible();
  });
  await when('the reader enters a different query', async () => {
    await input.fill('recovered');
  });
  await then('later searches still work and the retry used the original query', async () => {
    await expect(page.getByRole('heading', { name: 'recovered', exact: true })).toBeVisible();
    expect(queries).toEqual([null, 'broken', 'broken', 'recovered']);
  });
});

test('debounces typing and clears once immediately with keyboard accessible controls', async ({ page }) => {
  const queries: (string | null)[] = [];
  await given('the collection is loaded with a controllable debounce clock', async () => {
    await page.clock.install();
    await mockBooks(page);
    page.on('request', request => {
      if (request.url().startsWith(`${apiUrl}?`)) queries.push(new URL(request.url()).searchParams.get('q'));
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  });
  const input = page.getByRole('textbox', { name: 'Search catalogue' });
  const clear = page.getByRole('button', { name: 'Clear search', exact: true });
  const addBook = page.getByRole('link', { name: 'Add book', exact: true });
  await when('the reader tabs through the home link to search', async () => {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'BookMonkey home' })).toBeFocused();
    await page.keyboard.press('Tab');
  });
  await then('the search input has visible keyboard focus', async () => {
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS('outline-style', 'solid');
  });
  await when('the reader types and only 100ms elapse', async () => {
    await input.fill('pending');
    await page.clock.runFor(100);
  });
  await then('the search has not been requested before the debounce expires', async () => {
    expect(queries).toEqual([null]);
  });
  await when('the reader tabs to the clear control', async () => {
    await page.keyboard.press('Tab');
  });
  await then('the clear control has visible keyboard focus', async () => {
    await expect(clear).toBeFocused();
    await expect(clear).toHaveCSS('outline-style', 'solid');
  });
  await when('the reader activates clear using Enter', async () => {
    await page.keyboard.press('Enter');
  });
  await then('search clears immediately and cancels the pending debounced query', async () => {
    await expect(input).toHaveValue('');
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
    await page.clock.runFor(1000);
    expect(queries).toEqual([null, null]);
    await expect(input).toBeFocused();
  });
  await when('the reader tabs through the remaining header controls to Add book', async () => {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Search catalogue' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation', { name: 'Categories' }).getByRole('link')).toBeFocused();
    await page.keyboard.press('Tab');
  });
  await then('Add book has visible keyboard focus', async () => {
    await expect(addBook).toBeFocused();
    await expect(addBook).toHaveCSS('outline-style', 'solid');
  });
});

test('cancels stale requests immediately and preserves the latest results', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await given('the collection is loaded and one search responds slowly', async () => {
    await page.clock.install();
    await mockBooks(page);
    await page.route(`${apiUrl}?*`, async route => {
      const query = new URL(route.request().url()).searchParams.get('q');
      if (query === 'slow') await gate;
      await route.fulfill({ json: [{ ...book, title: query || book.title }] }).catch(() => {});
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  });
  const input = page.getByRole('textbox', { name: 'Search catalogue' });
  try {
    await when('the reader starts a slow search and then changes the query', async () => {
      const slowRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'slow');
      await input.fill('slow');
      await page.clock.runFor(300);
      await slowRequest;
      const cancelled = page.waitForEvent(
        'requestfailed',
        request => new URL(request.url()).searchParams.get('q') === 'slow'
      );
      await input.fill('latest');
      await cancelled;
    });
    await then('the old request is cancelled immediately and loading replaces old results', async () => {
      await expect(page.getByRole('status')).toHaveText('Loading books...');
      await expect(page.getByRole('heading', { name: book.title, exact: true })).toHaveCount(0);
    });
    await when('the latest query passes its debounce', async () => {
      await page.clock.runFor(300);
    });
    await then('only the latest search result appears', async () => {
      await expect(page.getByRole('heading', { name: 'latest', exact: true })).toBeVisible();
    });
  } finally {
    release();
  }
  await then('the late response cannot restore the slow search result', async () => {
    await expect(page.getByRole('heading', { name: 'slow', exact: true })).toHaveCount(0);
  });
});

test('destroys pending debounce when navigating away', async ({ page }) => {
  const searchRequests: string[] = [];
  await given('the collection is loaded with a controllable debounce clock', async () => {
    await page.clock.install();
    await mockBooks(page);
    page.on('request', request => {
      if (request.url().startsWith(`${apiUrl}?`) && new URL(request.url()).searchParams.has('q')) {
        searchRequests.push(request.url());
      }
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  });
  await when('the reader types a query and navigates to details before its debounce expires', async () => {
    await page.getByRole('textbox', { name: 'Search catalogue' }).fill('pending');
    await page.evaluate(() => {
      history.pushState({}, '', '/books/book-1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });
  await then('details open and the abandoned query never sends a request', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    await page.clock.runFor(1000);
    expect(searchRequests).toEqual([]);
  });
});

for (const cover of ['', coverUrl]) {
  test(`collection uses a placeholder for ${cover ? 'broken' : 'missing'} covers`, async ({ page }) => {
    await given(`a listed book has a ${cover ? 'broken' : 'missing'} cover`, async () => {
      await mockBooks(page, { ...book, cover });
      await page.route(coverUrl, route => route.fulfill({ status: 404 }));
    });
    await when('the reader opens the collection', async () => {
      await page.goto('/');
    });
    await then('a placeholder is displayed instead of a broken image', async () => {
      await expect(page.getByText('No cover available')).toBeVisible();
      await expect(page.getByRole('img')).toHaveCount(0);
    });
  });
}

test('a failed cover does not carry over to the next detail route', async ({ page }) => {
  const validCover = `${coverUrl}?valid`;
  await given('the current book has a failed cover and the next book has a valid cover', async () => {
    await mockBooks(page);
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
  });
  await when('the reader navigates to the next book without reloading the component', async () => {
    await page.evaluate(() => {
      history.pushState({}, '', '/books/next');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });
  await then('the next book cover is visible without the previous placeholder', async () => {
    await expect(page.getByRole('img', { name: `Cover of ${book.title}` })).toBeVisible();
    await expect(page.getByRole('article').getByText('No cover available')).toHaveCount(0);
  });
});
