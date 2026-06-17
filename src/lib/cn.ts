/**
 * Tiny classNames helper. Filters falsy values and joins with spaces.
 * Kept dependency-free to avoid pulling in clsx/tailwind-merge for the shell.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
