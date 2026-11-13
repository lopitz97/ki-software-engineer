import { expect, test } from '@playwright/test';
import { apiUrl, book, mockBooks } from './support/books';

test('header searches from details and updates the existing collection', async ({ page }) => {
  await mockBooks(page);
  await page.route(`${apiUrl}?*`, route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: [{ ...book, title: params.get('q') || book.title }] });
  });
  await page.goto(`/books/${book.id}`);
  const header = page.getByRole('banner');
  const search = header.getByRole('textbox', { name: 'Search catalogue' });
  await search.fill('Angular & TypeScript');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: 'Angular & TypeScript', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search catalogue' })).toHaveValue('Angular & TypeScript');
  await expect(page.getByRole('textbox')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);
  await search.fill('Different title');
  await header.getByRole('button', { name: 'Search catalogue' }).click();
  await expect(page.getByRole('heading', { name: 'Different title', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search catalogue' }).fill('Local filter');
  await expect(page.getByRole('heading', { name: 'Local filter', exact: true })).toBeVisible();
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: 'Local filter', exact: true })).toBeVisible();
  await page.reload();
  await expect(search).toHaveValue('Local filter');
  await expect(page.getByRole('heading', { name: 'Local filter', exact: true })).toBeVisible();
  await search.fill('');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
});

for (const width of [375, 1440]) {
  test(`header offers only the supported category and fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockBooks(page);
    await page.goto(`/books/${book.id}`);
    const header = page.getByRole('banner');
    const categories = header.getByRole('navigation', { name: 'Categories' });
    await expect(categories.getByRole('link')).toHaveCount(1);
    await expect(categories.getByRole('link')).toHaveText('Bücher');
    await expect(header.getByRole('textbox', { name: 'Search catalogue' })).toBeVisible();
    await expect(header.getByRole('combobox', { name: 'Theme', exact: true })).toBeVisible();
    expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await categories.getByRole('link').click();
    await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
    await page.getByRole('link', { name: `View details for ${book.title}` }).click();
    await header.getByRole('link', { name: 'BookMonkey home' }).click();
    await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
  });
}
