import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeControlComponent } from './theme-control.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeControlComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
