import { Page } from '@playwright/test';
import { Book } from '../../src/app/books/book';

export const appUrl = process.env['BOOKMONKEY_TEST_PRODUCTION'] ? 'http://localhost:4201' : 'http://localhost:4202';
export const apiUrl = process.env['BOOKMONKEY_TEST_PRODUCTION'] ? `${appUrl}/api/books` : 'http://localhost:4730/books';
export const coverUrl = 'http://localhost:4730/covers/test.png';
export const book = {
  id: 'book-1',
  isbn: '9781234567890',
  title: 'A Book to Remember',
  subtitle: 'Stories for everyone',
  author: 'Ada Reader',
  publisher: 'Example Press',
  numPages: 321,
  price: '19.95',
  cover: coverUrl,
  abstract: 'First paragraph.\nSecond paragraph with <b>literal markup</b>.',
  userId: 42
} satisfies Book;

export async function mockBooks(page: Page, selectedBook: Book = book): Promise<void> {
  await page.route(
    url => url.origin + url.pathname === apiUrl,
    async route => {
      const id = new URL(route.request().url()).searchParams.get('id');
      await route.fulfill({ json: !id || id === selectedBook.id ? [selectedBook] : [] });
    }
  );
  await page.route(coverUrl, route =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#dbeafe"/></svg>'
    })
  );
}
