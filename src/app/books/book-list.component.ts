import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  catchError,
  distinctUntilChanged,
  map,
  merge,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  timer
} from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookItemComponent } from './book-item.component';

type CollectionState =
  | { status: 'loading' | 'error'; query: string }
  | { status: 'success'; query: string; books: Book[] };
type SearchRequest = { query: string; debounce: boolean; retry?: boolean };

@Component({
  selector: 'app-book-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, ReactiveFormsModule, BookItemComponent],
  templateUrl: './book-list.component.html'
})
export class BookListComponent {
  private readonly api = inject(BookApiClient);
  private readonly requests = new Subject<SearchRequest>();
  readonly search = new FormControl('', { nonNullable: true });

  readonly state$: Observable<CollectionState> = merge(
    this.search.valueChanges.pipe(map((query): SearchRequest => ({ query, debounce: query !== '' }))),
    this.requests
  ).pipe(
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

  clearSearch(): void {
    this.search.setValue('');
  }

  retry(query: string): void {
    this.requests.next({ query, debounce: false, retry: true });
  }
}
