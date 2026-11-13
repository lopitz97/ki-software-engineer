import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';
import { BookDraft } from './book-draft';
import { BookFormComponent } from './book-form.component';

@Component({
  selector: 'app-book-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookFormComponent],
  template: `
    <app-book-form
      [initialBook]="book()"
      [saving]="saving()"
      [error]="saveError() ? 'Unable to save the book. Please try again.' : null"
      (submitted)="save($event)"
      (cancelled)="cancelled.emit()"
    />
  `
})
export class BookEditComponent {
  private readonly api = inject(BookApiClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly book = input.required<Book>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  readonly saving = signal(false);
  readonly saveError = signal(false);
  save(draft: BookDraft): void {
    if (this.saving()) return;
    const { isbn, ...changes } = draft;
    this.saving.set(true);
    this.saveError.set(false);
    this.api
      .updateBook(this.book(), changes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.saved.emit(),
        error: () => {
          this.saving.set(false);
          this.saveError.set(true);
        }
      });
  }
}
