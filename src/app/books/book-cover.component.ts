import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-book-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full bg-gray-100 dark:bg-gray-800' },
  template: `
    @if (url() && !failed()) {
      <img [src]="url()" [alt]="alt()" (error)="failed.set(true)" class="w-full h-full object-contain" />
    } @else {
      <div class="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm font-medium">
        No cover available
      </div>
    }
  `
})
export class BookCoverComponent {
  readonly url = input.required<string>();
  readonly alt = input.required<string>();
  protected readonly failed = linkedSignal({ source: this.url, computation: () => false });
}
