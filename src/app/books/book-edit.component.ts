import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Book } from './book';
import { BookApiClient } from './book-api-client.service';

@Component({
  selector: 'app-book-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './book-edit.component.html'
})
export class BookEditComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(BookApiClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly book = input.required<Book>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  readonly saving = signal(false);
  readonly saveError = signal(false);
  readonly textFields = [
    { key: 'title', label: 'Title', required: true },
    { key: 'subtitle', label: 'Subtitle', required: false },
    { key: 'author', label: 'Author', required: true },
    { key: 'publisher', label: 'Publisher', required: false },
    { key: 'cover', label: 'Cover URL', required: false }
  ] as const;
  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.pattern(/\S/)]],
    subtitle: '',
    author: ['', [Validators.required, Validators.pattern(/\S/)]],
    publisher: '',
    cover: '',
    abstract: '',
    numPages: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.pattern(/^\d+$/)
    ]),
    price: new FormControl<number | null>(null, Validators.min(0))
  });

  ngOnInit(): void {
    const book = this.book();
    this.form.reset({
      title: book.title,
      subtitle: book.subtitle ?? '',
      author: book.author ?? '',
      publisher: book.publisher ?? '',
      cover: book.cover ?? '',
      abstract: book.abstract ?? '',
      numPages: book.numPages ?? null,
      price: book.price === '' || book.price == null ? null : Number(book.price)
    });
  }

  save(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    if (values.numPages === null) return;

    this.saving.set(true);
    this.saveError.set(false);
    this.api
      .updateBook(this.book(), { ...values, numPages: values.numPages, price: values.price ?? undefined })
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
