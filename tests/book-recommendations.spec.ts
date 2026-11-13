import { expect, test } from '@playwright/test';
import { given, then, when } from './support/bdd';
import { apiUrl, appUrl, book, mockBooks } from './support/books';

test('shows other books, prioritizes the same author and opens their details', async ({ page }) => {
  const others = Array.from({ length: 8 }, (_, index) => ({
    ...book,
    id: `suggestion-${index}`,
    title: `Suggested book ${index}`,
    author: index === 7 ? book.author : 'Another author'
  }));
  await given('other books include a title by the same author', async () => {
    await mockBooks(page);
    await page.route(`${apiUrl}?*`, route => {
      const id = new URL(route.request().url()).searchParams.get('id');
      return route.fulfill({ json: id ? [book, ...others].filter(item => item.id === id) : [book, ...others] });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
  });
  await when('the reader opens the book details', async () => {
    await page.goto(`${appUrl}/books/${book.id}`);
  });
  const section = page.getByRole('region', { name: 'Für Sie empfohlen' });
  const links = section.getByRole('link');
  await then('recommendations prioritize the same author and exclude the current book', async () => {
    await expect(links).toHaveCount(8);
    await expect(links.first()).toHaveAccessibleName('Buchdetails: Suggested book 7');
    await expect(section.getByRole('link', { name: `Buchdetails: ${book.title}`, exact: true })).toHaveCount(0);
  });
  const list = section.getByRole('list');
  await when('the reader scrolls forward', async () => {
    await section.getByRole('button', { name: 'Weitere Buchvorschläge' }).click();
  });
  await then('more recommendations become reachable', async () => {
    await expect.poll(() => list.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  });
  await when('the reader scrolls back', async () => {
    await section.getByRole('button', { name: 'Vorherige Buchvorschläge' }).click();
  });
  await then('the recommendation list returns to its start', async () => {
    await expect.poll(() => list.evaluate(element => element.scrollLeft)).toBe(0);
  });
  await when('the reader opens the first recommendation using the keyboard', async () => {
    await links.first().focus();
    await page.keyboard.press('Enter');
  });
  await then('the recommended book opens and is no longer recommended to itself', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Suggested book 7');
    await expect(section.getByRole('link', { name: 'Buchdetails: Suggested book 7', exact: true })).toHaveCount(0);
  });
});

test('keeps details available on recommendation failure and retries to an empty state', async ({ page }) => {
  let failed = false;
  await given('recommendations fail once and then contain no other books', async () => {
    await mockBooks(page);
    await page.route(`${apiUrl}?_limit=*`, route => {
      const status = failed ? 200 : 500;
      failed = true;
      return route.fulfill({ status, json: [book] });
    });
  });
  const section = page.getByRole('region', { name: 'Für Sie empfohlen' });
  await when('the reader opens the book details', async () => {
    await page.goto(`${appUrl}/books/${book.id}`);
  });
  await then('book details remain available alongside the recommendation error', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
    await expect(section.getByRole('status')).toContainText('konnten nicht geladen werden');
  });
  await when('the reader retries recommendations', async () => {
    await section.getByRole('button', { name: 'Erneut versuchen' }).click();
  });
  await then('an empty recommendation message replaces the error', async () => {
    await expect(section).toContainText('keine weiteren Buchvorschläge');
  });
});

test('contains the recommendation scroller within the mobile viewport', async ({ page }) => {
  await given('ten recommendations are available on a mobile viewport', async () => {
    await mockBooks(page);
    await page.route(`${apiUrl}?_limit=*`, route =>
      route.fulfill({ json: Array.from({ length: 10 }, (_, i) => ({ ...book, id: `other-${i}`, title: `Book ${i}` })) })
    );
    await page.setViewportSize({ width: 390, height: 844 });
  });
  await when('the reader opens the book details', async () => {
    await page.goto(`${appUrl}/books/${book.id}`);
  });
  await then('all recommendation links fit without overflowing the page', async () => {
    await expect(page.getByRole('region', { name: 'Für Sie empfohlen' }).getByRole('link')).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
