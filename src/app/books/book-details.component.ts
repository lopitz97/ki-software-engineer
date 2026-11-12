import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  of,
  startWith,
  Subject,
  switchMap
} from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookCoverComponent } from './book-cover.component';

type DetailsState = { status: 'loading' | 'not-found' | 'error' } | { status: 'success'; book: Book };

@Component({
  selector: 'app-book-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, BookCoverComponent],
  templateUrl: './book-details.component.html'
})
export class BookDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BookApiClient);
  private readonly retryRequests = new Subject<void>();

  readonly state$: Observable<DetailsState> = combineLatest([
    this.route.paramMap.pipe(
      map(params => params.get('id')!),
      distinctUntilChanged()
    ),
    this.retryRequests.pipe(startWith(undefined))
  ]).pipe(
    switchMap(([id]) =>
      this.api.getBook(id).pipe(
        map((book): DetailsState => ({ status: 'success', book })),
        catchError((error: unknown) =>
          of<DetailsState>({
            status: error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error'
          })
        ),
        startWith<DetailsState>({ status: 'loading' })
      )
    )
  );

  retry(): void {
    this.retryRequests.next();
  }
}
