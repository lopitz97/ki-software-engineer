import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-user-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>user-icon works!</p>`
})
export class UserIcon {}
