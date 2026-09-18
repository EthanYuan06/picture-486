export function toWebpUrl(url?: string | null): string {
  if (!url) return '';
  const [base, query] = url.split('?', 2);
  if (base.toLowerCase().endsWith('.webp')) {
    return url;
  }
  const dotIndex = base.lastIndexOf('.');
  const pathWithoutExt = dotIndex === -1 ? base : base.slice(0, dotIndex);
  const normalizedPath =
    pathWithoutExt.endsWith('_thumbnail')
      ? pathWithoutExt.slice(0, -'_thumbnail'.length)
      : pathWithoutExt;
  const nextBase = `${normalizedPath}.webp`;
  return query ? `${nextBase}?${query}` : nextBase;
}
