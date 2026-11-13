import { Book } from './book';

export interface BookPage {
  books: Book[];
  hasNext: boolean;
}
