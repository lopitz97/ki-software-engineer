import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, distinctUntilChanged, map, Observable, of, startWith, Subject, switchMap, timer } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookItemComponent } from './book-item.component';

type CollectionState =
  | { status: 'loading' | 'error'; query: string }
  | { status: 'success'; query: string; books: Book[] };
type SearchRequest = { query: string; debounce: boolean; retry?: boolean };

@Component({
  selector: 'app-book-list',
  standalone: true,
  imports: [AsyncPipe, FormsModule, BookItemComponent],
  templateUrl: './book-list.component.html'
})
export class BookListComponent {
  private readonly api = inject(BookApiClient);
  private readonly requests = new Subject<SearchRequest>();
  searchTerm = '';

  readonly state$: Observable<CollectionState> = this.requests.pipe(
    startWith<SearchRequest>({ query: '', debounce: false }),
    distinctUntilChanged((previous, current) => !current.retry && previous.query === current.query),
    // Cancel both the pending delay and HTTP request as soon as the input changes.
    switchMap(({ query, debounce }) =>
      (debounce ? timer(300) : of(0)).pipe(
        switchMap(() => this.api.getBooks(undefined, query)),
        map((books): CollectionState => ({ status: 'success', query, books })),
        catchError(() => of<CollectionState>({ status: 'error', query })),
        startWith<CollectionState>({ status: 'loading', query })
      )
    )
  );

  onSearchChange(query: string): void {
    this.searchTerm = query;
    this.requests.next({ query, debounce: query !== '' });
  }

  clearSearch(): void {
    this.onSearchChange('');
  }

  retry(query: string): void {
    this.requests.next({ query, debounce: false, retry: true });
  }
}
