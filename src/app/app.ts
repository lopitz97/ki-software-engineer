import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ThemeControlComponent } from './theme-control.component';
import { BookSearch } from './books/book-search.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, ThemeControlComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly search = inject(BookSearch);
  private readonly router = inject(Router);

  searchBooks(event: Event, query: string): void {
    event.preventDefault();
    void this.router.navigate(['/'], {
      queryParams: query.trim() ? { q: query.trim() } : {},
      onSameUrlNavigation: 'reload'
    });
  }
}
