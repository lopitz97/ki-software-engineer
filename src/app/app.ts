import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeControlComponent } from './theme-control.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ThemeControlComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
