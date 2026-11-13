import { BookChanges } from './book-changes';

export type BookDraft = BookChanges & { isbn: string };
