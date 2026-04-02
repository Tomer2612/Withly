export function getImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  // NEXT_PUBLIC_API_URL may end with /api — strip it for static file paths like /uploads/...
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}${url}`;
}
