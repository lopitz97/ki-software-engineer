import { expect, test } from '@playwright/test';
import { apiUrl, appUrl, book, mockBooks } from './support/books';

test('shows other books, prioritizes the same author and opens their details', async ({ page }) => {
  await mockBooks(page);
  const others = Array.from({ length: 8 }, (_, index) => ({
    ...book,
    id: `suggestion-${index}`,
    title: `Suggested book ${index}`,
    author: index === 7 ? book.author : 'Another author'
  }));
  await page.route(`${apiUrl}?*`, route => {
    const id = new URL(route.request().url()).searchParams.get('id');
    return route.fulfill({ json: id ? [book, ...others].filter(item => item.id === id) : [book, ...others] });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${appUrl}/books/${book.id}`);
  const section = page.getByRole('region', { name: 'Für Sie empfohlen' });
  const links = section.getByRole('link');
  await expect(links).toHaveCount(8);
  await expect(links.first()).toHaveAccessibleName('Buchdetails: Suggested book 7');
  await expect(section.getByRole('link', { name: `Buchdetails: ${book.title}`, exact: true })).toHaveCount(0);
  const list = section.getByRole('list');
  await section.getByRole('button', { name: 'Weitere Buchvorschläge' }).click();
  await expect.poll(() => list.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await section.getByRole('button', { name: 'Vorherige Buchvorschläge' }).click();
  await expect.poll(() => list.evaluate(element => element.scrollLeft)).toBe(0);
  await links.first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Suggested book 7');
  await expect(section.getByRole('link', { name: 'Buchdetails: Suggested book 7', exact: true })).toHaveCount(0);
});

test('keeps details available on recommendation failure and retries to an empty state', async ({ page }) => {
  await mockBooks(page);
  let failed = false;
  await page.route(`${apiUrl}?_limit=*`, route => {
    const status = failed ? 200 : 500;
    failed = true;
    return route.fulfill({ status, json: [book] });
  });
  await page.goto(`${appUrl}/books/${book.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
  const section = page.getByRole('region', { name: 'Für Sie empfohlen' });
  await expect(section.getByRole('status')).toContainText('konnten nicht geladen werden');
  await section.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(section).toContainText('keine weiteren Buchvorschläge');
});

test('contains the recommendation scroller within the mobile viewport', async ({ page }) => {
  await mockBooks(page);
  await page.route(`${apiUrl}?_limit=*`, route =>
    route.fulfill({ json: Array.from({ length: 10 }, (_, i) => ({ ...book, id: `other-${i}`, title: `Book ${i}` })) })
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}/books/${book.id}`);
  await expect(page.getByRole('region', { name: 'Für Sie empfohlen' }).getByRole('link')).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
