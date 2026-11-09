import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Book } from './book';

@Injectable({ providedIn: 'root' })
export class BookApiClient {
  private readonly apiUrl = 'http://localhost:4730/books';

  constructor(private http: HttpClient) {}

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

  getBooks(pageSize: number = 10, searchTerm?: string): Observable<Book[]> {
    let params = new HttpParams().set('_limit', pageSize.toString());

    if (searchTerm) {
      // Search in title and author fields
      params = params.set('q', searchTerm);
    }

    return this.http.get<Book[]>(this.apiUrl, { params });
  }
}
