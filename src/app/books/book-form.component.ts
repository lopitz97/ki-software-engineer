import { ChangeDetectionStrategy, Component, inject, input, OnInit, output } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Book } from './book';
import { BookDraft } from './book-draft';

@Component({
  selector: 'app-book-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './book-form.component.html'
})
export class BookFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly initialBook = input<Book>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<BookDraft>();
  readonly cancelled = output<void>();
  readonly textFields = [
    { key: 'title', label: 'Title', required: true },
    { key: 'subtitle', label: 'Subtitle', required: false },
    { key: 'author', label: 'Author', required: true },
    { key: 'publisher', label: 'Publisher', required: false },
    { key: 'cover', label: 'Cover URL', required: false }
  ] as const;
  readonly form = this.fb.group({
    isbn: ['', [Validators.required, Validators.pattern(/\S/)]],
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
    const book = this.initialBook();
    if (!book) return;
    this.form.reset({
      isbn: book.isbn,
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

  submit(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    if (values.numPages === null) return;
    this.submitted.emit({ ...values, numPages: values.numPages, price: values.price ?? undefined });
  }
}
