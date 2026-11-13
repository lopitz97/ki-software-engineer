import { test } from '@playwright/test';

type StepAction<T> = () => Promise<T>;

function step<T>(keyword: 'Given' | 'When' | 'Then', description: string, action: StepAction<T>): Promise<T> {
  return test.step(`${keyword} ${description}`, action);
}

export function given<T>(description: string, action: StepAction<T>): Promise<T> {
  return step('Given', description, action);
}

export function when<T>(description: string, action: StepAction<T>): Promise<T> {
  return step('When', description, action);
}

export function then<T>(description: string, action: StepAction<T>): Promise<T> {
  return step('Then', description, action);
}
