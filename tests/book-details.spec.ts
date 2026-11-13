import { expect, test } from '@playwright/test';
import { given, then, when } from './support/bdd';
import { apiUrl, appUrl, book, coverUrl, mockBooks } from './support/books';

test('opens details using the keyboard and returns to the collection', async ({ page }) => {
  const link = page.getByRole('link', { name: `View details for ${book.title}` });
  await given('a book is listed in the collection', async () => {
    await mockBooks(page);
    await page.goto(appUrl);
    await expect(link).toHaveAttribute('href', '/books/book-1');
  });
  await when('the reader opens its details using the keyboard', async () => {
    await page.getByRole('link', { name: 'Add book' }).focus();
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
  });
  await then('the selected book details are shown', async () => {
    await expect(page).toHaveURL(`${appUrl}/books/book-1`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  });
  await when('the reader returns using the keyboard', async () => {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Back to collection' })).toBeFocused();
    await page.keyboard.press('Enter');
  });
  await then('the collection is shown again', async () => {
    await expect(page).toHaveURL(`${appUrl}/`);
    await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
  });
});

test('supports direct links and refresh, displaying all public fields as text', async ({ page }) => {
  await given('a book with all public fields is available', async () => {
    await mockBooks(page);
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await when(
      attempt === 0 ? 'the reader opens the direct detail URL' : 'the reader reloads the details',
      async () => {
        if (attempt === 0) await page.goto(`${appUrl}/books/book-1`);
        else await page.reload();
      }
    );
    await then('all public fields are displayed as literal text without internal metadata', async () => {
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
    });
  }
});

test('omits absent optional text and provides a missing-cover placeholder', async ({ page }) => {
  await given('a book has no subtitle, description or cover', async () => {
    await mockBooks(page, { ...book, subtitle: undefined, abstract: '', cover: '' });
  });
  await when('the reader opens the book details', async () => {
    await page.goto(`${appUrl}/books/book-1`);
  });
  await then('missing text is omitted and a cover placeholder is shown', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    await expect(page.getByText('No cover available')).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(page.getByText(book.subtitle)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'About this book' })).toHaveCount(0);
  });
});

test('replaces a failed cover image with a placeholder', async ({ page }) => {
  await given('the book cover cannot be loaded', async () => {
    await mockBooks(page);
    await page.route(coverUrl, route => route.fulfill({ status: 404 }));
  });
  await when('the reader opens the book details', async () => {
    await page.goto(`${appUrl}/books/book-1`);
  });
  await then('a placeholder replaces the failed image', async () => {
    await expect(page.getByText('No cover available')).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
  });
});

test('shows loading until the request completes', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await given('the book response is delayed', async () => {
    await mockBooks(page);
    await page.route(`${apiUrl}?id=*`, async route => {
      await gate;
      await route.fulfill({ json: [book] });
    });
  });
  try {
    await when('the reader opens the book details', async () => {
      await page.goto(`${appUrl}/books/book-1`);
    });
    await then('loading is announced and navigation remains available without stale details', async () => {
      await expect(page.getByRole('status')).toHaveText('Loading book...');
      await expect(page.getByRole('link', { name: 'Back to collection' })).toBeVisible();
      await expect(page.locator('article')).toHaveCount(0);
    });
  } finally {
    release();
  }
  await then('the book appears when its response arrives', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  });
});

for (const response of ['empty', '404'] as const) {
  test(`shows book not found for ${response} responses`, async ({ page }) => {
    await given(`the requested book returns an ${response} response`, async () => {
      await mockBooks(page);
      await page.route(`${apiUrl}?id=*`, route =>
        route.fulfill(response === 'empty' ? { json: [] } : { status: 404, json: { message: 'Not found' } })
      );
    });
    await when('the reader opens the missing book URL', async () => {
      await page.goto(`${appUrl}/books/missing`);
    });
    await then('not found is shown with a way back but no retry action', async () => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book not found');
      await expect(page.getByRole('link', { name: 'Back to collection' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
    });
  });
}

test('allows retry after a server error', async ({ page }) => {
  let requests = 0;
  await given('loading the book fails once before recovering', async () => {
    await mockBooks(page);
    await page.route(`${apiUrl}?id=*`, route => {
      requests++;
      return route.fulfill(requests === 1 ? { status: 500 } : { json: [book] });
    });
  });
  await when('the reader opens the book details', async () => {
    await page.goto(`${appUrl}/books/book-1`);
  });
  await then('an error and navigation back to the collection are shown', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unable to load book');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to collection' })).toBeVisible();
  });
  await when('the reader retries loading', async () => {
    await page.getByRole('button', { name: 'Retry' }).click();
  });
  await then('the book is displayed after a second request', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    expect(requests).toBe(2);
  });
});

test('encodes special characters in book identifiers', async ({ page }) => {
  const specialBook = { ...book, id: 'book & another? / +' };
  await given('a listed book has special characters in its identifier', async () => {
    await mockBooks(page, specialBook);
    await page.goto(appUrl);
  });
  const request = await when('the reader opens its details', async () => {
    const detailsRequest = page.waitForRequest(request => new URL(request.url()).searchParams.has('id'));
    await page.getByRole('link', { name: `View details for ${book.title}` }).click();
    return await detailsRequest;
  });
  await then('the exact identifier reaches the API and the book is displayed', async () => {
    expect(new URL(request.url()).searchParams.get('id')).toBe(specialBook.id);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  });
});

test('clears stale content and cancels requests when the route identifier changes', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await given('a book is displayed while another book loads slowly', async () => {
    await mockBooks(page);
    await page.route(`${apiUrl}?id=slow-book`, async route => {
      await gate;
      await route.fulfill({ json: [{ ...book, id: 'slow-book', title: 'Stale book' }] }).catch(() => {});
    });
    await page.goto(`${appUrl}/books/book-1`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  });
  try {
    await when('the reader navigates to the slow book without reloading the component', async () => {
      const slowRequest = page.waitForRequest(`${apiUrl}?id=slow-book`);
      await page.evaluate(() => {
        history.pushState({}, '', '/books/slow-book');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await slowRequest;
    });
    await then('loading replaces the previous book details', async () => {
      await expect(page.getByRole('status')).toHaveText('Loading book...');
      await expect(page.getByText(book.title, { exact: true })).toHaveCount(0);
    });
    await when('the reader navigates back before loading completes', async () => {
      const cancelledRequest = page.waitForEvent(
        'requestfailed',
        request => request.url() === `${apiUrl}?id=slow-book`
      );
      await page.evaluate(() => history.back());
      await cancelledRequest;
    });
    await then('the original book is restored', async () => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    });
  } finally {
    release();
  }
  await then('the late response cannot display stale book details', async () => {
    await expect(page.getByText('Stale book')).toHaveCount(0);
  });
});

for (const width of [390, 1280]) {
  test(`lays out details without horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
    await given(`a book is available on a ${width}px viewport`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await mockBooks(page);
    });
    await when('the reader opens its details', async () => {
      await page.goto(`${appUrl}/books/book-1`);
    });
    await then('the cover and title use the responsive layout without horizontal overflow', async () => {
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
  });
}
