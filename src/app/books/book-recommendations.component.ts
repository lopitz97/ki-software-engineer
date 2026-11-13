import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookCoverComponent } from './book-cover.component';

type RecommendationsState = { status: 'loading' | 'error' } | { status: 'success'; books: Book[] };

@Component({
  selector: 'app-book-recommendations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, BookCoverComponent],
  templateUrl: './book-recommendations.component.html'
})
export class BookRecommendationsComponent {
  readonly book = input.required<Book>();
  private readonly api = inject(BookApiClient);
  private readonly retries = new Subject<void>();

  readonly state$ = toObservable(this.book).pipe(
    switchMap(book =>
      this.retries.pipe(
        startWith(undefined),
        switchMap(() =>
          this.api.getBooks(16).pipe(
            map(
              (books): RecommendationsState => ({
                status: 'success',
                books: books
                  .filter(candidate => candidate.id !== book.id)
                  .sort((a, b) => Number(b.author === book.author) - Number(a.author === book.author))
                  .slice(0, 10)
              })
            ),
            catchError(() => of<RecommendationsState>({ status: 'error' })),
            startWith<RecommendationsState>({ status: 'loading' })
          )
        )
      )
    )
  );

  retry(): void {
    this.retries.next();
  }

  scroll(list: HTMLElement, direction: number): void {
    list.scrollBy({ left: direction * list.clientWidth, behavior: 'smooth' });
  }
}
