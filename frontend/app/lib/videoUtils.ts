// Supported video URL patterns
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
const VIMEO_REGEX = /(?:vimeo\.com\/)(\d+)/;
const DAILYMOTION_REGEX = /(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/;

export type VideoProvider = 'youtube' | 'vimeo' | 'dailymotion' | 'mp4' | 'unknown';

export function getVideoProvider(url: string): VideoProvider {
  if (!url) return 'unknown';
  if (YOUTUBE_REGEX.test(url)) return 'youtube';
  if (VIMEO_REGEX.test(url)) return 'vimeo';
  if (DAILYMOTION_REGEX.test(url)) return 'dailymotion';
  if (/\.(mp4|webm|mov|ogg)(\?|$)/i.test(url)) return 'mp4';
  return 'unknown';
}

export function isValidVideoUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const provider = getVideoProvider(url);
  return provider !== 'unknown';
}

export function getYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

export function getVimeoVideoId(url: string): string | null {
  const match = url.match(VIMEO_REGEX);
  return match ? match[1] : null;
}

export function getDailymotionVideoId(url: string): string | null {
  const match = url.match(DAILYMOTION_REGEX);
  return match ? match[1] : null;
}

export function getVideoThumbnail(url: string): string | null {
  const provider = getVideoProvider(url);
  if (provider === 'youtube') {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  }
  if (provider === 'vimeo') {
    // Vimeo thumbnails require API call; return null and let component handle it
    return null;
  }
  return null;
}

export function getProviderLabel(provider: VideoProvider): string {
  const labels: Record<VideoProvider, string> = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    dailymotion: 'Dailymotion',
    mp4: 'MP4',
    unknown: '',
  };
  return labels[provider];
}

export const VIDEO_MIMETYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
export const MAX_VIDEO_SIZE_MB = 100;
export const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
