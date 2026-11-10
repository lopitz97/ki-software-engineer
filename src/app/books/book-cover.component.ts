import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-book-cover',
  standalone: true,
  host: { class: 'block h-full bg-gray-100 dark:bg-gray-800' },
  template: `
    @if (url && !failed) {
      <img [src]="url" [alt]="alt" (error)="failed = true" class="w-full h-full object-contain" />
    } @else {
      <div class="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm font-medium">
        No cover available
      </div>
    }
  `
})
export class BookCoverComponent implements OnChanges {
  @Input({ required: true }) url!: string;
  @Input({ required: true }) alt!: string;
  failed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['url']) {
      this.failed = false;
    }
  }
}
