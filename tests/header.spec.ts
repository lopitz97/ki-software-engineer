import { expect, test } from '@playwright/test';
import { given, then, when } from './support/bdd';
import { apiUrl, book, mockBooks } from './support/books';

test('header searches from details and updates the existing collection', async ({ page }) => {
  await given('the reader is viewing a book with catalogue search available', async () => {
    await mockBooks(page);
    await page.route(`${apiUrl}?*`, route => {
      const params = new URL(route.request().url()).searchParams;
      return route.fulfill({ json: [{ ...book, title: params.get('q') || book.title }] });
    });
    await page.goto(`/books/${book.id}`);
  });
  const header = page.getByRole('banner');
  const search = header.getByRole('textbox', { name: 'Search catalogue' });
  await when('the reader submits a search from details using Enter', async () => {
    await search.fill('Angular & TypeScript');
    await search.press('Enter');
  });
  await then('the collection shows matching results with a single shared search field', async () => {
    await expect(page.getByRole('heading', { name: 'Angular & TypeScript', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search catalogue' })).toHaveValue('Angular & TypeScript');
    await expect(page.getByRole('textbox')).toHaveCount(1);
    await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);
  });
  await when('the reader submits another query using the search button', async () => {
    await search.fill('Different title');
    await header.getByRole('button', { name: 'Search catalogue' }).click();
  });
  await then('the existing collection shows the new result', async () => {
    await expect(page.getByRole('heading', { name: 'Different title', exact: true })).toBeVisible();
  });
  await when('the reader types a local filter', async () => {
    await page.getByRole('textbox', { name: 'Search catalogue' }).fill('Local filter');
  });
  await then('the collection updates without explicit submission', async () => {
    await expect(page.getByRole('heading', { name: 'Local filter', exact: true })).toBeVisible();
  });
  await when('the reader submits the filter using Enter', async () => {
    await search.press('Enter');
  });
  await then('the matching result remains visible', async () => {
    await expect(page.getByRole('heading', { name: 'Local filter', exact: true })).toBeVisible();
  });
  await when('the reader reloads the page', async () => {
    await page.reload();
  });
  await then('the submitted query and its result are restored', async () => {
    await expect(search).toHaveValue('Local filter');
    await expect(page.getByRole('heading', { name: 'Local filter', exact: true })).toBeVisible();
  });
  await when('the reader submits an empty search', async () => {
    await search.fill('');
    await search.press('Enter');
  });
  await then('the unfiltered collection is shown', async () => {
    await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  });
});

for (const width of [375, 1440]) {
  test(`header offers only the supported category and fits at ${width}px`, async ({ page }) => {
    await given(`a book is available on a ${width}px viewport`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await mockBooks(page);
    });
    await when('the reader opens the book details', async () => {
      await page.goto(`/books/${book.id}`);
    });
    const header = page.getByRole('banner');
    const categories = header.getByRole('navigation', { name: 'Categories' });
    await then('the header offers only supported navigation and fits the viewport', async () => {
      await expect(categories.getByRole('link')).toHaveCount(1);
      await expect(categories.getByRole('link')).toHaveText('Bücher');
      await expect(header.getByRole('textbox', { name: 'Search catalogue' })).toBeVisible();
      await expect(header.getByRole('combobox', { name: 'Theme', exact: true })).toBeVisible();
      expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    });
    await when('the reader selects the books category', async () => {
      await categories.getByRole('link').click();
    });
    await then('the collection is shown', async () => {
      await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
    });
    await when('the reader opens details and selects the home link', async () => {
      await page.getByRole('link', { name: `View details for ${book.title}` }).click();
      await header.getByRole('link', { name: 'BookMonkey home' }).click();
    });
    await then('the home link also returns to the collection', async () => {
      await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
    });
  });
}
