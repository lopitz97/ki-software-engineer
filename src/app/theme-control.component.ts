import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';

type ThemePreference = 'system' | 'light' | 'dark';

@Component({
  selector: 'app-theme-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-200">
      Theme
      <select
        #theme
        [value]="preference()"
        (change)="setPreference(theme.value)"
        class="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:outline-blue-300"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `
})
export class ThemeControlComponent {
  private readonly document = inject(DOCUMENT);
  private readonly browser = this.document.defaultView!;
  private readonly deviceTheme = this.browser.matchMedia('(prefers-color-scheme: dark)');
  protected readonly preference = signal<ThemePreference>(this.readPreference());
  private readonly deviceDark = signal(this.deviceTheme.matches);
  private readonly dark = computed(
    () => this.preference() === 'dark' || (this.preference() === 'system' && this.deviceDark())
  );

  constructor() {
    effect(() => {
      this.document.documentElement.classList.toggle('dark', this.dark());
      this.document.documentElement.style.colorScheme = this.dark() ? 'dark' : 'light';
    });
    const onDeviceChange = (event: MediaQueryListEvent) => this.deviceDark.set(event.matches);
    this.deviceTheme.addEventListener('change', onDeviceChange);
    inject(DestroyRef).onDestroy(() => this.deviceTheme.removeEventListener('change', onDeviceChange));
  }

  setPreference(value: string): void {
    if (value !== 'system' && value !== 'light' && value !== 'dark') return;
    this.preference.set(value);
    try {
      this.browser.localStorage.setItem('bookmonkey-theme', value);
    } catch {
      // Storage may be disabled; theme selection still works for the current session.
    }
  }

  private readPreference(): ThemePreference {
    try {
      const saved = this.browser.localStorage.getItem('bookmonkey-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Use the device theme when saved preferences are unavailable.
    }
    return 'system';
  }
}
