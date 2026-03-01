export const ADOPTED_CAT_LIMIT = 0;

type CatLike = {
  origin?: string | null;
  ability?: string | null;
  description?: string | null;
  image_review_reason?: string | null;
};

export function isAdoptedCat(row: CatLike): boolean {
  return String(row.origin || '').toLowerCase() === 'adopted';
}
