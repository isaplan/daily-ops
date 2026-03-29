/**
 * Slug utilities for converting titles to URL-friendly slugs
 * and resolving slugs back to document IDs
 */

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export function isMongoId(str: string): boolean {
  return /^[0-9a-f]{24}$/i.test(str);
}

export function slugToFilter(slug: string): { slug?: string; _id?: string } {
  if (isMongoId(slug)) {
    return { _id: slug };
  }
  return { slug };
}
