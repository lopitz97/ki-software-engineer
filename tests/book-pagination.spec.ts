import { expect, Page, test } from '@playwright/test';
import { given, then, when } from './support/bdd';
import { Book } from '../src/app/books/book';
import { apiUrl, book, mockBooks } from './support/books';

const collection: Book[] = Array.from({ length: 23 }, (_, index) => ({
  ...book,
  id: `pagination-book-${index + 1}`,
  isbn: `978123456${String(index + 1).padStart(4, '0')}`,
  title: index < 12 ? `Angular Guide ${index + 1}` : `Workshop Book ${index + 1}`
}));
const nextName = /^(Next|Next page|Weiter|Nächste Seite)$/i;
const previousName = /^(Previous|Previous page|Zurück|Vorherige Seite)$/i;
const paginationName = /pagination|paginierung|seitennavigation/i;

async function mockPaginatedBooks(page: Page, books: Book[] = collection) {
  await mockBooks(page);
  const requests: { page: number; limit: number; query: string; explicitPage: boolean }[] = [];
  let failSecondPage = false;
  await page.route(
    url => url.origin + url.pathname === apiUrl,
    async route => {
      const params = new URL(route.request().url()).searchParams;
      const pageNumber = Number(params.get('_page') ?? '1');
      const limit = Number(params.get('_limit') ?? '10');
      const query = params.get('q') ?? '';
      requests.push({ page: pageNumber, limit, query, explicitPage: params.has('_page') });
      if (failSecondPage && pageNumber === 2) {
        failSecondPage = false;
        await route.fulfill({ status: 500 });
        return;
      }
      const matches = books.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
      const start = (pageNumber - 1) * limit;
      await route.fulfill({
        headers: {
          'X-Total-Count': String(matches.length),
          'Access-Control-Expose-Headers': 'X-Total-Count'
        },
        json: matches.slice(start, start + limit)
      });
    }
  );
  return {
    requests,
    failNextSecondPage: () => {
      failSecondPage = true;
    }
  };
}

function pagination(page: Page) {
  return page.getByRole('navigation', { name: paginationName });
}

async function expectPage(page: Page, number: number) {
  await expect(pagination(page)).toContainText(new RegExp(`(?:Page|Seite)\\s+${number}(?:\\D|$)`, 'i'));
}

test('shows ten books per page and navigates forward, back and to the final partial page', async ({ page }) => {
  const api = await given('the catalogue contains 23 books', async () => {
    return await mockPaginatedBooks(page);
  });
  await when('the reader opens the collection', async () => {
    await page.goto('/');
  });
  const cards = page.getByRole('link', { name: /^View details for / });
  const previous = pagination(page).getByRole('button', { name: previousName });
  const next = pagination(page).getByRole('button', { name: nextName });
  await then('the first ten books are shown with only forward navigation enabled', async () => {
    await expect(page.getByRole('heading', { name: collection[0].title, exact: true })).toBeVisible();
    await expect(pagination(page)).toBeVisible();
    await expect(cards).toHaveCount(10);
    await expectPage(page, 1);
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
  });
  await when('the reader advances using the keyboard', async () => {
    await next.focus();
    await page.keyboard.press('Enter');
  });
  await then('the second ten books replace the first page', async () => {
    await expectPage(page, 2);
    await expect(cards).toHaveCount(10);
    await expect(page.getByRole('heading', { name: collection[10].title, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: collection[0].title, exact: true })).toHaveCount(0);
    await expect(previous).toBeEnabled();
  });
  await when('the reader advances to the last page', async () => {
    await next.click();
  });
  await then('the final three books are shown and further navigation is disabled', async () => {
    await expectPage(page, 3);
    await expect(cards).toHaveCount(3);
    await expect(page.getByRole('heading', { name: collection[20].title, exact: true })).toBeVisible();
    await expect(next).toBeDisabled();
  });
  await when('the reader returns to the previous page', async () => {
    await previous.click();
  });
  await then('page two is restored and every request uses an explicit page with ten books', async () => {
    await expectPage(page, 2);
    await expect(page.getByRole('heading', { name: collection[10].title, exact: true })).toBeVisible();
    expect(api.requests.map(request => request.page)).toEqual([1, 2, 3, 2]);
    expect(api.requests.every(request => request.limit === 10 && request.explicitPage)).toBe(true);
  });
});

test('paginates search results and resets to page one when the query changes or is cleared', async ({ page }) => {
  const api = await given('the reader is on page two of a catalogue with multiple search result pages', async () => {
    const api = await mockPaginatedBooks(page);
    await page.goto('/');
    await expect(pagination(page)).toBeVisible();
    await pagination(page).getByRole('button', { name: nextName }).click();
    await expectPage(page, 2);
    return api;
  });
  await when('the reader searches for Angular', async () => {
    await page.getByRole('textbox', { name: 'Search catalogue' }).fill('Angular');
  });
  await then('the search starts on page one with ten matching books', async () => {
    await expectPage(page, 1);
    await expect(page.getByRole('link', { name: /^View details for / })).toHaveCount(10);
  });
  await when('the reader advances through the search results', async () => {
    await pagination(page).getByRole('button', { name: nextName }).click();
  });
  await then('the last two matches are shown without further forward navigation', async () => {
    await expectPage(page, 2);
    await expect(page.getByRole('link', { name: /^View details for / })).toHaveCount(2);
    await expect(pagination(page).getByRole('button', { name: nextName })).toBeDisabled();
  });
  await when('the reader changes the query to Workshop', async () => {
    await page.getByRole('textbox', { name: 'Search catalogue' }).fill('Workshop');
  });
  await then('the new search resets to its first page', async () => {
    await expectPage(page, 1);
    await expect(page.getByRole('heading', { name: collection[12].title, exact: true })).toBeVisible();
  });
  await when('the reader advances and clears the search', async () => {
    await pagination(page).getByRole('button', { name: nextName }).click();
    await expectPage(page, 2);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  });
  await then('the unfiltered first page returns and all requests retain the expected page and query', async () => {
    await expectPage(page, 1);
    await expect(page.getByRole('heading', { name: collection[0].title, exact: true })).toBeVisible();
    expect(api.requests.map(({ page, query }) => ({ page, query }))).toEqual([
      { page: 1, query: '' },
      { page: 2, query: '' },
      { page: 1, query: 'Angular' },
      { page: 2, query: 'Angular' },
      { page: 1, query: 'Workshop' },
      { page: 2, query: 'Workshop' },
      { page: 1, query: '' }
    ]);
  });
});

test('disables Next on a final full page using the total result count', async ({ page }) => {
  const api = await given('the catalogue has exactly two full pages', async () => {
    const api = await mockPaginatedBooks(page, collection.slice(0, 20));
    await page.goto('/');
    await expect(pagination(page)).toBeVisible();
    return api;
  });
  await when('the reader opens page two', async () => {
    await pagination(page).getByRole('button', { name: nextName }).click();
  });
  await then('the last ten books are shown with Next disabled and Previous enabled', async () => {
    await expectPage(page, 2);
    await expect(page.getByRole('link', { name: /^View details for / })).toHaveCount(10);
    await expect(page.getByRole('heading', { name: collection[10].title, exact: true })).toBeVisible();
    await expect(pagination(page).getByRole('button', { name: nextName })).toBeDisabled();
    await expect(pagination(page).getByRole('button', { name: previousName })).toBeEnabled();
    expect(api.requests.map(request => request.page)).toEqual([1, 2]);
  });
});

test('retries the failed page with its current search instead of returning to the first page', async ({ page }) => {
  const api = await given('Angular search results are loaded and their second page will fail once', async () => {
    const api = await mockPaginatedBooks(page);
    await page.goto('/');
    await expect(pagination(page)).toBeVisible();
    await page.getByRole('textbox', { name: 'Search catalogue' }).fill('Angular');
    await expect.poll(() => api.requests.at(-1)?.query).toBe('Angular');
    await expectPage(page, 1);
    api.failNextSecondPage();
    return api;
  });
  await when('the reader opens the second results page', async () => {
    await pagination(page).getByRole('button', { name: nextName }).click();
  });
  await then('an error replaces the previous results', async () => {
    await expect(page.getByRole('alert')).toContainText('Unable to load books');
    await expect(page.getByRole('heading', { name: collection[0].title, exact: true })).toHaveCount(0);
  });
  await when('the reader retries loading', async () => {
    await page.getByRole('button', { name: 'Retry' }).click();
  });
  await then('the same search page is retried rather than resetting to page one', async () => {
    await expectPage(page, 2);
    await expect(page.getByRole('heading', { name: collection[10].title, exact: true })).toBeVisible();
    expect(api.requests.slice(-2).map(({ page, query }) => ({ page, query }))).toEqual([
      { page: 2, query: 'Angular' },
      { page: 2, query: 'Angular' }
    ]);
  });
});

test('cancels an outstanding page request immediately when the search changes', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await given('the reader has an outstanding request for the second catalogue page', async () => {
    await page.clock.install();
    await mockPaginatedBooks(page);
    await page.route(
      url => url.origin + url.pathname === apiUrl && url.searchParams.get('_page') === '2',
      async route => {
        await gate;
        await route
          .fulfill({
            headers: { 'X-Total-Count': '23', 'Access-Control-Expose-Headers': 'X-Total-Count' },
            json: collection.slice(10, 20)
          })
          .catch(() => {});
      }
    );
    await page.goto('/');
    await expect(pagination(page)).toBeVisible();
    const pending = page.waitForRequest(request => new URL(request.url()).searchParams.get('_page') === '2');
    await pagination(page).getByRole('button', { name: nextName }).click();
    await pending;
  });
  try {
    await when('the reader changes the search while that page is pending', async () => {
      const cancelled = page.waitForEvent(
        'requestfailed',
        request => new URL(request.url()).searchParams.get('_page') === '2'
      );
      await page.getByRole('textbox', { name: 'Search catalogue' }).fill('Workshop');
      await cancelled;
    });
    await then('the page request is cancelled immediately and loading is announced', async () => {
      await expect(page.getByRole('status')).toHaveText('Loading books...');
    });
    await when('the new search passes its debounce', async () => {
      await page.clock.runFor(300);
    });
    await then('the first page of the new search appears', async () => {
      await expectPage(page, 1);
      await expect(page.getByRole('heading', { name: collection[12].title, exact: true })).toBeVisible();
    });
  } finally {
    release();
  }
  await then('the late page response cannot restore old catalogue results', async () => {
    await expect(page.getByRole('heading', { name: collection[10].title, exact: true })).toHaveCount(0);
  });
});

test('does not allow navigation beyond an empty search result', async ({ page }) => {
  await given('the paginated catalogue is open', async () => {
    await mockPaginatedBooks(page);
    await page.goto('/');
    await expect(pagination(page)).toBeVisible();
  });
  await when('the reader searches for a query with no matches', async () => {
    await page.getByRole('textbox', { name: 'Search catalogue' }).fill('no matching books');
  });
  await then('the empty first page disables navigation in both directions', async () => {
    await expect(page.getByRole('status')).toHaveText('No books match your search');
    await expectPage(page, 1);
    await expect(pagination(page).getByRole('button', { name: previousName })).toBeDisabled();
    await expect(pagination(page).getByRole('button', { name: nextName })).toBeDisabled();
  });
});
