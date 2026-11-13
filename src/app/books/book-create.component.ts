import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { BookApiClient } from './book-api-client.service';
import { BookDraft } from './book-draft';
import { BookFormComponent } from './book-form.component';

@Component({
  selector: 'app-book-create',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookFormComponent],
  template: `
    <div class="container mx-auto px-4 py-12 max-w-5xl">
      <app-book-form [saving]="saving()" [error]="error()" (submitted)="create($event)" (cancelled)="cancel()" />
    </div>
  `
})
export class BookCreateComponent {
  private readonly api = inject(BookApiClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  create(draft: BookDraft): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .createBook(draft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: book => {
          void this.router.navigate(['/books', book.id]);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(
            error instanceof HttpErrorResponse && error.status === 409
              ? 'A book with this ISBN already exists. Please enter a different ISBN.'
              : 'Unable to create the book. Please try again.'
          );
        }
      });
  }

  cancel(): void {
    if (!this.saving()) void this.router.navigate(['/']);
  }
}
