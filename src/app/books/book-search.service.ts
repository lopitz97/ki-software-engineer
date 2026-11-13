import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BookSearch {
  readonly query = signal('');
  private readonly changes = new Subject<string>();
  readonly changes$ = this.changes.asObservable();

  change(query: string): void {
    this.query.set(query);
    this.changes.next(query);
  }
}
