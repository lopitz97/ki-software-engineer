import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, Observable, of, startWith, Subject, switchMap, timer } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookItemComponent } from './book-item.component';

type CollectionState =
  | { status: 'loading' | 'error'; query: string; page: number }
  | { status: 'success'; query: string; page: number; books: Book[]; hasNext: boolean };
type SearchRequest = { query: string; page: number; debounce: boolean; retry?: boolean };

@Component({
  selector: 'app-book-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, FormField, RouterLink, BookItemComponent],
  templateUrl: './book-list.component.html'
})
export class BookListComponent {
  private readonly api = inject(BookApiClient);
  private readonly requests = new Subject<SearchRequest>();
  private readonly searchModel = signal({ query: '' });
  readonly search = form(this.searchModel);

  readonly state$: Observable<CollectionState> = this.requests.pipe(
    startWith<SearchRequest>({ query: '', page: 1, debounce: false }),
    distinctUntilChanged(
      (previous, current) => !current.retry && previous.query === current.query && previous.page === current.page
    ),
    // Cancel both the pending delay and HTTP request as soon as the input changes.
    switchMap(({ query, page, debounce }) =>
      (debounce ? timer(300) : of(0)).pipe(
        switchMap(() => this.api.getBooksPage(page, query)),
        map((result): CollectionState => ({ status: 'success', query, page, ...result })),
        catchError(() => of<CollectionState>({ status: 'error', query, page })),
        startWith<CollectionState>({ status: 'loading', query, page })
      )
    )
  );

  searchChanged(query: string): void {
    // Dispatch synchronously so a new keystroke cancels pending work immediately.
    this.requests.next({ query, page: 1, debounce: query !== '' });
  }

  clearSearch(): void {
    this.search.query().value.set('');
    this.searchChanged('');
  }

  changePage(query: string, page: number): void {
    if (page < 1) return;
    this.requests.next({ query, page, debounce: false });
  }

  retry(query: string, page: number): void {
    this.requests.next({ query, page, debounce: false, retry: true });
  }
}
