import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { environment } from '../environments/environment';
import { BOOK_API_BASE_URL } from './books/book-api-url';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: 1 }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: BOOK_API_BASE_URL, useValue: environment.apiBaseUrl }
  ]
};
