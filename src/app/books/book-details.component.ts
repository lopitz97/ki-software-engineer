import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
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

type DetailsState = { status: 'loading' | 'not-found' | 'error' } | { status: 'success'; book: Book };

@Component({
  selector: 'app-book-details',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  template: `
    <div class="container mx-auto px-4 py-12 max-w-5xl">
      <a
        routerLink="/"
        class="inline-block mb-8 text-blue-700 underline rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
      >
        Back to collection
      </a>

      @if (state$ | async; as state) {
        @switch (state.status) {
          @case ('loading') {
            <h1 class="text-3xl font-bold text-blue-700 mb-4">Book details</h1>
            <p role="status" class="py-12 text-gray-600">Loading book...</p>
          }
          @case ('not-found') {
            <h1 class="text-3xl font-bold text-blue-700 mb-4">Book not found</h1>
            <p role="status" class="text-gray-600">This book could not be found in the collection.</p>
          }
          @case ('error') {
            <h1 class="text-3xl font-bold text-blue-700 mb-4">Unable to load book</h1>
            <p role="alert" class="text-gray-600">Something went wrong. Please try again.</p>
            <button
              type="button"
              (click)="retry()"
              class="mt-4 bg-blue-700 hover:bg-blue-800 text-white rounded-md px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              Retry
            </button>
          }
          @case ('success') {
            <article
              class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-8 bg-white rounded-lg shadow-md p-6"
            >
              <div class="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                @if (state.book.cover && !coverFailed) {
                  <img
                    [src]="state.book.cover"
                    [alt]="'Cover of ' + state.book.title"
                    (error)="coverFailed = true"
                    class="w-full h-full object-contain"
                  />
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-gray-500">No cover available</div>
                }
              </div>
              <div class="min-w-0 break-words">
                <h1 class="text-3xl font-bold text-blue-700 mb-3">{{ state.book.title }}</h1>
                @if (state.book.subtitle) {
                  <p class="text-xl text-gray-600 mb-3">{{ state.book.subtitle }}</p>
                }
                <p class="text-lg text-gray-700 mb-6">By {{ state.book.author }}</p>
                <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-gray-700">
                  <dt class="font-semibold">ISBN</dt>
                  <dd>{{ state.book.isbn }}</dd>
                  <dt class="font-semibold">Publisher</dt>
                  <dd>{{ state.book.publisher }}</dd>
                  <dt class="font-semibold">Pages</dt>
                  <dd>{{ state.book.numPages }}</dd>
                  <dt class="font-semibold">Price</dt>
                  <dd>{{ state.book.price }}</dd>
                </dl>
                @if (state.book.abstract) {
                  <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-3">About this book</h2>
                  <p class="whitespace-pre-line text-gray-700 leading-relaxed">{{ state.book.abstract }}</p>
                }
              </div>
            </article>
          }
        }
      }
    </div>
  `
})
export class BookDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BookApiClient);
  private readonly retryRequests = new Subject<void>();
  coverFailed = false;

  readonly state$: Observable<DetailsState> = combineLatest([
    this.route.paramMap.pipe(
      map(params => params.get('id')!),
      distinctUntilChanged()
    ),
    this.retryRequests.pipe(startWith(undefined))
  ]).pipe(
    switchMap(([id]) => {
      this.coverFailed = false;
      return this.api.getBook(id).pipe(
        map((book): DetailsState => ({ status: 'success', book })),
        catchError((error: unknown) =>
          of<DetailsState>({
            status: error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error'
          })
        ),
        startWith<DetailsState>({ status: 'loading' })
      );
    })
  );

  retry(): void {
    this.retryRequests.next();
  }
}
