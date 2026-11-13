import { expect, Locator, Page, test } from '@playwright/test';
import { given, then, when } from './support/bdd';
import { apiUrl, book, mockBooks } from './support/books';

// Requirements: https://github.com/lopitz97/ki-software-engineer/issues/1
type Appearance = 'Light' | 'Dark';
type Preference = Appearance | 'System';

// Accept native selects, radio groups, or toggle buttons without prescribing component markup or storage keys.
function themeSelect(page: Page): Locator {
  return page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'System', exact: true }) });
}

function themeControl(page: Page): Locator {
  return themeSelect(page)
    .or(page.getByRole('radio', { name: 'System', exact: true }))
    .or(page.getByRole('button', { name: 'System', exact: true }));
}

async function expectSelected(page: Page, preference: Preference): Promise<void> {
  await expect(themeControl(page)).toBeVisible();
  if (await themeSelect(page).count()) {
    await expect(themeSelect(page).getByRole('option', { selected: true })).toHaveText(preference);
  } else if (await page.getByRole('radio', { name: preference, exact: true }).count()) {
    await expect(page.getByRole('radio', { name: preference, exact: true })).toBeChecked();
  } else {
    await expect(page.getByRole('button', { name: preference, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
}

async function selectTheme(page: Page, preference: Preference): Promise<void> {
  await expect(themeControl(page)).toBeVisible();
  if (await themeSelect(page).count()) {
    await themeSelect(page).selectOption({ label: preference });
  } else if (await page.getByRole('radio', { name: preference, exact: true }).count()) {
    await page.getByRole('radio', { name: preference, exact: true }).check();
  } else {
    await page.getByRole('button', { name: preference, exact: true }).click();
  }
  await expectSelected(page, preference);
}

async function expectAppearance(surface: Locator, appearance: Appearance): Promise<void> {
  await expect(surface).toBeVisible();
  // Inspect rendered backgrounds, including transparent ancestors, rather than a particular CSS class or data attribute.
  await expect
    .poll(
      () =>
        surface.evaluate(element => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d')!;
          const ancestors: Element[] = [];
          for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
            ancestors.unshift(ancestor);
          }
          context.fillStyle = 'white';
          context.fillRect(0, 0, 1, 1);
          for (const ancestor of ancestors) {
            context.fillStyle = getComputedStyle(ancestor).backgroundColor;
            context.fillRect(0, 0, 1, 1);
          }
          const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
          // Classify brightness without choosing a product palette.
          return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
        }),
      { message: `Expected the rendered surface to use a ${appearance.toLowerCase()} background` }
    )
    [appearance === 'Dark' ? 'toBeLessThan' : 'toBeGreaterThan'](0.5);
}

async function expectShell(page: Page, appearance: Appearance): Promise<void> {
  for (const surface of [page.getByRole('banner'), page.getByRole('main'), page.getByRole('contentinfo')]) {
    await expectAppearance(surface, appearance);
  }
}

for (const appearance of ['Light', 'Dark'] as const) {
  test(`defaults to System and the ${appearance.toLowerCase()} device appearance`, async ({ page }) => {
    await given(`the device uses a ${appearance.toLowerCase()} appearance with no saved preference`, async () => {
      await mockBooks(page);
      await page.emulateMedia({ colorScheme: appearance === 'Dark' ? 'dark' : 'light' });
    });
    await when('the reader opens the collection', async () => {
      await page.goto('/');
    });
    await then(`System is selected and the application uses the ${appearance.toLowerCase()} appearance`, async () => {
      await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
      await expectShell(page, appearance);
      await expectSelected(page, 'System');
    });
  });

  test(`manually selects ${appearance} across the collection and details`, async ({ page }) => {
    await given(`the collection is open with the device appearance opposite to ${appearance}`, async () => {
      await mockBooks(page);
      await page.emulateMedia({ colorScheme: appearance === 'Dark' ? 'light' : 'dark' });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
    });
    await when(`the reader manually selects ${appearance}`, async () => {
      await selectTheme(page, appearance);
    });
    await then('the collection and search use the selected appearance', async () => {
      await expectShell(page, appearance);
      await expectAppearance(page.getByRole('heading', { name: book.title, exact: true }), appearance);
      await expectAppearance(page.getByRole('textbox', { name: 'Search catalogue' }), appearance);
    });
    await when('the reader opens book details', async () => {
      await page.getByRole('link', { name: `View details for ${book.title}` }).click();
    });
    await then('the details and shell retain the selected appearance', async () => {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(book.title);
      await expectShell(page, appearance);
      await expectAppearance(page.getByRole('article'), appearance);
      await expectSelected(page, appearance);
    });
  });

  test(`keeps the ${appearance} override when the device appearance changes`, async ({ page }) => {
    await given(`the reader has manually selected ${appearance}`, async () => {
      await mockBooks(page);
      await page.emulateMedia({ colorScheme: appearance === 'Dark' ? 'dark' : 'light' });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
      await selectTheme(page, appearance);
    });
    await when('the device switches to the opposite appearance', async () => {
      await page.emulateMedia({ colorScheme: appearance === 'Dark' ? 'light' : 'dark' });
    });
    await then('the manual appearance and selected preference remain unchanged', async () => {
      await expectShell(page, appearance);
      await expectSelected(page, appearance);
    });
  });

  test(`returning from ${appearance} to System follows the current device and later changes`, async ({ page }) => {
    await given(`a manual ${appearance} preference overrides the device appearance`, async () => {
      await mockBooks(page);
      await page.emulateMedia({ colorScheme: appearance === 'Dark' ? 'light' : 'dark' });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
      await selectTheme(page, appearance);
    });
    await when('the reader returns to System', async () => {
      await selectTheme(page, 'System');
    });
    await then('the application follows the current device appearance', async () => {
      await expectShell(page, appearance === 'Dark' ? 'Light' : 'Dark');
    });
    await when('the device appearance changes again', async () => {
      await page.emulateMedia({ colorScheme: appearance === 'Dark' ? 'dark' : 'light' });
    });
    await then('the application follows the new appearance while System remains selected', async () => {
      await expectShell(page, appearance);
      await expectSelected(page, 'System');
    });
  });

  test(`the theme control can select ${appearance} using only the keyboard`, async ({ page }) => {
    const control = await given('the collection has a visible and accessibly named theme control', async () => {
      await mockBooks(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
      await expect(themeControl(page)).toBeVisible();
      const control = (await themeSelect(page).count())
        ? themeSelect(page)
        : (await page.getByRole('radio', { name: 'System', exact: true }).count())
          ? page.getByRole('radio', { name: 'System', exact: true })
          : page.getByRole('button', { name: appearance, exact: true });
      await expect(control).not.toHaveAccessibleName('');
      return control;
    });
    await when('the reader tabs to the theme control', async () => {
      const controls = await page.getByRole('banner').locator('a, button, input, select, [tabindex]').count();
      for (let step = 0; step <= controls; step++) {
        await page.keyboard.press('Tab');
        if (await control.evaluate(element => element === document.activeElement)) break;
      }
    });
    await then('the control has visible keyboard focus', async () => {
      await expect(control).toBeFocused();
      await expect
        .poll(() =>
          control.evaluate(element => {
            const style = getComputedStyle(element);
            return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
          })
        )
        .toBe(true);
    });
    await when(`the reader selects ${appearance} using only keyboard input`, async () => {
      if (await themeSelect(page).count()) {
        await page.keyboard.press('Home');
        const labels = await themeSelect(page).getByRole('option').allTextContents();
        const target = labels.findIndex(label => label.trim() === appearance);
        expect(target).toBeGreaterThanOrEqual(0);
        for (let step = 0; step < target; step++) await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      } else if (await page.getByRole('radio', { name: 'System', exact: true }).count()) {
        const target = page.getByRole('radio', { name: appearance, exact: true });
        for (let step = 0; step < 3 && !(await target.isChecked()); step++) {
          await page.keyboard.press('ArrowRight');
        }
      } else {
        await page.keyboard.press('Space');
      }
    });
    await then('the selected appearance is applied throughout the shell', async () => {
      await expectSelected(page, appearance);
      await expectShell(page, appearance);
    });
  });
}

test('System follows device appearance changes in both directions while the app stays open', async ({ page }) => {
  await given('System is active on a light device with the collection open', async () => {
    await mockBooks(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
    await expectShell(page, 'Light');
  });
  await when('the device switches to dark without closing the application', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
  });
  await then('the application switches to dark', async () => {
    await expectShell(page, 'Dark');
  });
  await when('the device switches back to light', async () => {
    await page.emulateMedia({ colorScheme: 'light' });
  });
  await then('the application returns to light while System remains selected', async () => {
    await expectShell(page, 'Light');
    await expectSelected(page, 'System');
  });
});

for (const preference of ['System', 'Light', 'Dark'] as const) {
  test(`remembers ${preference} after refresh and reopening with the same browser storage`, async ({
    page,
    browser
  }) => {
    await given(`the reader has saved the ${preference} preference on a light device`, async () => {
      await mockBooks(page);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
      await selectTheme(page, preference === 'System' ? 'Dark' : 'System');
      await selectTheme(page, preference);
    });
    await when('the reader refreshes the application', async () => {
      await page.reload();
    });
    await then('the selected preference and resolved appearance are restored', async () => {
      await expect(page.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
      await expectSelected(page, preference);
      await expectShell(page, preference === 'Dark' ? 'Dark' : 'Light');
    });

    // Capture storage written by the real control, without knowing its key or injecting a preference.
    const reopened = await browser.newContext({
      storageState: await page.context().storageState(),
      colorScheme: 'dark'
    });
    try {
      const reopenedPage = await when(
        'the reader reopens the application with saved storage on a dark device',
        async () => {
          const reopenedPage = await reopened.newPage();
          await mockBooks(reopenedPage);
          await reopenedPage.goto(new URL('/', page.url()).href);
          return reopenedPage;
        }
      );
      await then('the saved preference is preserved and resolved against the new device appearance', async () => {
        await expect(reopenedPage.getByRole('heading', { name: 'Book Collection' })).toBeVisible();
        await expectSelected(reopenedPage, preference);
        await expectShell(reopenedPage, preference === 'Light' ? 'Light' : 'Dark');
      });
    } finally {
      await reopened.close();
    }
  });
}

for (const path of ['/', '/books/book-1']) {
  for (const state of ['loading', 'empty', 'error'] as const) {
    test(`dark device appearance applies to the ${state} state at ${path}`, async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      await given(`the device is dark and the API produces a ${state} state`, async () => {
        await mockBooks(page);
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.route(`${apiUrl}?*`, async route => {
          if (state === 'loading') await gate;
          await route.fulfill(state === 'error' ? { status: 500 } : { json: [] });
        });
      });
      try {
        await when(`the reader opens ${path}`, async () => {
          await page.goto(path);
        });
        await then(`the ${state} message and shell use a dark appearance`, async () => {
          const status = page.getByRole(state === 'error' ? 'alert' : 'status');
          await expect(status).toBeVisible();
          const expected =
            state === 'loading'
              ? path === '/'
                ? 'Loading books...'
                : 'Loading book...'
              : state === 'empty'
                ? path === '/'
                  ? 'No books available'
                  : 'This book could not be found in the collection.'
                : path === '/'
                  ? 'Unable to load books. Please try again.'
                  : 'Something went wrong. Please try again.';
          await expect(status).toHaveText(expected);
          await expectAppearance(status, 'Dark');
          await expectShell(page, 'Dark');
        });
      } finally {
        release();
      }
    });
  }
}
