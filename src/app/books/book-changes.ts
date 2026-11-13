import { Book } from './book';

export type BookChanges = Pick<
  Book,
  'title' | 'subtitle' | 'author' | 'publisher' | 'numPages' | 'cover' | 'abstract'
> & {
  price: number | undefined;
};
