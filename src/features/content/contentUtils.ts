export function generateSlug(section: string, title: string) {
  return `${section}-${title}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
