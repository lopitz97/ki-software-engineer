import { ChangeDetectionStrategy, Component, input, OnInit, output, signal } from '@angular/core';
import { disabled, form, FormField, FormRoot, min, pattern, required, validate } from '@angular/forms/signals';
import { Book } from './book';
import { BookDraft } from './book-draft';

@Component({
  selector: 'app-book-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, FormRoot],
  templateUrl: './book-form.component.html'
})
export class BookFormComponent implements OnInit {
  readonly initialBook = input<Book>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<BookDraft>();
  readonly cancelled = output<void>();
  readonly textFields = [
    { key: 'title', label: 'Title' },
    { key: 'subtitle', label: 'Subtitle' },
    { key: 'author', label: 'Author' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'cover', label: 'Cover URL' }
  ] as const;
  private readonly model = signal({
    isbn: '',
    title: '',
    subtitle: '',
    author: '',
    publisher: '',
    cover: '',
    abstract: '',
    numPages: null as number | null,
    price: null as number | null
  });
  readonly form = form(
    this.model,
    path => {
      disabled(path, () => this.saving());
      for (const field of [path.isbn, path.title, path.author]) {
        required(field);
        pattern(field, /\S/);
      }
      required(path.numPages);
      min(path.numPages, 0);
      validate(path.numPages, ({ value }) =>
        value() === null || Number.isInteger(value()) ? null : { kind: 'integer' }
      );
      min(path.price, 0);
    },
    {
      submission: {
        action: async () => {
          if (this.saving()) return;
          const values = this.model();
          if (values.numPages === null) return;
          this.submitted.emit({ ...values, numPages: values.numPages, price: values.price ?? undefined });
        }
      }
    }
  );

  ngOnInit(): void {
    const book = this.initialBook();
    if (!book) return;
    this.model.set({
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
}
