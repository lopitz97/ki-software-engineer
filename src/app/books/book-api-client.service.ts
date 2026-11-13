import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { BOOK_API_BASE_URL } from './book-api-url';
import { Book } from './book';
import { BookChanges } from './book-changes';

@Injectable({ providedIn: 'root' })
export class BookApiClient {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(BOOK_API_BASE_URL).replace(/\/$/, '')}/books`;

  updateBook(book: Book, changes: BookChanges): Observable<unknown> {
    // Preserve fields outside the editor while replacing optional values, including an omitted price.
    const { id, ...draft } = book;
    return this.http.put(`${this.apiUrl}/${encodeURIComponent(book.isbn)}`, { ...draft, ...changes });
  }

  getBook(id: string): Observable<Book> {
    // The API's /books/:isbn endpoint uses ISBN, while application routes use IDs.
    const params = new HttpParams().set('id', id);
    return this.http.get<Book[]>(this.apiUrl, { params }).pipe(
      map(books => {
        const book = books.find(book => book.id === id);
        if (!book) {
          throw new HttpErrorResponse({ status: 404, statusText: 'Book not found' });
        }
        return book;
      })
    );
  }

  getBooks(pageSize = 10, searchTerm?: string): Observable<Book[]> {
    let params = new HttpParams().set('_limit', pageSize.toString());

    if (searchTerm) {
      // Search semantics are defined by the backend.
      params = params.set('q', searchTerm);
    }

    return this.http.get<Book[]>(this.apiUrl, { params });
  }
}
