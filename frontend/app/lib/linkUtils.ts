// URL helpers for community links (social profiles + owner's custom website).
// Mirrors the backend DTO regexes in src/communities/dto/communities.dto.ts —
// keep the two in sync so a value the form accepts is never 400'd on save.

// Prepend https:// when the owner typed a bare domain ("mysite.co.il").
// Also used at render time, so legacy values saved without a protocol still
// open correctly and a stored `javascript:` value becomes a dead https link.
export function withProtocol(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// Any http(s) URL with a dotted host and no whitespace.
export function isValidWebsiteUrl(value: string): boolean {
  if (!value.trim()) return true;
  return /^https?:\/\/[^\s/.]+\.[^\s]+$/i.test(withProtocol(value));
}

// Accepted hosts per platform (subdomains allowed: m.facebook.com, chat.whatsapp.com, ...).
export const SOCIAL_DOMAINS = {
  youtube: ['youtube.com', 'youtu.be'],
  whatsapp: ['whatsapp.com', 'wa.me'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  instagram: ['instagram.com', 'instagr.am'],
  linkedin: ['linkedin.com'],
} as const;

export type SocialPlatform = keyof typeof SOCIAL_DOMAINS;

const socialPatterns = Object.fromEntries(
  (Object.keys(SOCIAL_DOMAINS) as SocialPlatform[]).map((p) => [
    p,
    new RegExp(
      `^https?:\\/\\/([a-z0-9-]+\\.)*(${SOCIAL_DOMAINS[p].map((d) => d.replace(/\./g, '\\.')).join('|')})([/?#]\\S*)?$`,
      'i',
    ),
  ]),
) as Record<SocialPlatform, RegExp>;

// Empty is valid (clears the link).
export function isValidSocialUrl(value: string, platform: SocialPlatform): boolean {
  if (!value.trim()) return true;
  return socialPatterns[platform].test(withProtocol(value));
}

// Keep in sync with @MaxLength on customLinkLabel in the backend DTO.
export const CUSTOM_LINK_LABEL_MAX = 20;
export const CUSTOM_LINK_DEFAULT_LABEL = 'מעבר לאתר';
