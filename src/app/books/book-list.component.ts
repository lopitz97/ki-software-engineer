import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  catchError,
  distinctUntilChanged,
  filter,
  map,
  merge,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
  timer
} from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookItemComponent } from './book-item.component';
import { BookSearch } from './book-search.service';

type CollectionState =
  | { status: 'loading' | 'error'; query: string; page: number }
  | { status: 'success'; query: string; page: number; books: Book[]; hasNext: boolean };
type SearchRequest = { query: string; page: number; debounce: boolean; retry?: boolean };

@Component({
  selector: 'app-book-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, BookItemComponent],
  templateUrl: './book-list.component.html'
})
export class BookListComponent {
  private readonly api = inject(BookApiClient);
  private readonly requests = new Subject<SearchRequest>();
  private readonly search = inject(BookSearch);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeSearch$ = merge(
    of(null),
    this.router.events.pipe(filter(event => event instanceof NavigationEnd))
  ).pipe(
    map(() => this.route.snapshot.queryParamMap.get('q') ?? ''),
    tap(query => this.search.query.set(query)),
    map((query): SearchRequest => ({ query, page: 1, debounce: false }))
  );

  readonly state$: Observable<CollectionState> = merge(
    this.routeSearch$,
    this.requests,
    this.search.changes$.pipe(map((query): SearchRequest => ({ query, page: 1, debounce: query !== '' })))
  ).pipe(
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

  clearSearch(): void {
    this.search.change('');
  }

  changePage(query: string, page: number): void {
    if (page < 1) return;
    this.requests.next({ query, page, debounce: false });
  }

  retry(query: string, page: number): void {
    this.requests.next({ query, page, debounce: false, retry: true });
  }
}
