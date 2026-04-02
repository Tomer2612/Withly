'use client';

import { useState, useEffect, useRef } from 'react';
import { getVideoProvider, getYouTubeVideoId, getVimeoVideoId, getDailymotionVideoId } from '@/app/lib/videoUtils';
import { getImageUrl } from '@/app/lib/imageUrl';
import PlayIcon from './icons/PlayIcon';

interface VideoPlayerProps {
  url: string;
  className?: string;
  onEnded?: () => void;
}

export default function VideoPlayer({ url, className = '', onEnded }: VideoPlayerProps) {
  const [activated, setActivated] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const provider = getVideoProvider(url);

  // Reset facade when the URL changes (e.g. gallery navigation)
  useEffect(() => {
    setActivated(false);
  }, [url]);

  // YouTube: pre-load iframe with JS API, postMessage to play on click
  if (provider === 'youtube') {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return null;
    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    return (
      <div className={`relative aspect-video bg-black rounded-xl overflow-hidden ${className}`}>
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0`}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
        {!activated && (
          <div
            className="absolute inset-0 cursor-pointer z-10"
            onClick={() => {
              setActivated(true);
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                  JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                  '*'
                );
              }
            }}
          >
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayIcon className="w-16 h-16 md:w-20 md:h-20" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vimeo: pre-load iframe, postMessage to play on click
  if (provider === 'vimeo') {
    const videoId = getVimeoVideoId(url);
    if (!videoId) return null;

    return (
      <div className={`relative aspect-video bg-black rounded-xl overflow-hidden ${className}`}>
        <iframe
          ref={iframeRef}
          src={`https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0`}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
        {!activated && (
          <div
            className="absolute inset-0 cursor-pointer z-10"
            onClick={() => {
              setActivated(true);
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                  JSON.stringify({ method: 'play' }),
                  '*'
                );
              }
            }}
          >
            <VimeoThumbnailImg videoId={videoId} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayIcon className="w-16 h-16 md:w-20 md:h-20" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Dailymotion: use native player (no facade — cross-origin blocks autoplay)
  if (provider === 'dailymotion') {
    const videoId = getDailymotionVideoId(url);
    if (!videoId) return null;

    return (
      <div className={`relative aspect-video bg-black rounded-xl overflow-hidden ${className}`}>
        <iframe
          src={`https://geo.dailymotion.com/player.html?video=${videoId}`}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  // MP4/WebM/MOV: single video element with play overlay
  const videoSrc = url.startsWith('http') ? url : getImageUrl(url);

  return (
    <div className={`relative aspect-video bg-black rounded-xl overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-contain"
        preload="metadata"
        controls={activated}
        onEnded={onEnded}
      />
      {!activated && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={() => {
            setActivated(true);
            videoRef.current?.play();
          }}
        >
          <PlayIcon className="w-16 h-16 md:w-20 md:h-20" />
        </div>
      )}
    </div>
  );
}

// Internal: fetches Vimeo thumbnail via oEmbed API
function VimeoThumbnailImg({ videoId, className }: { videoId: string; className?: string }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}&width=640`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.thumbnail_url) setThumbUrl(data.thumbnail_url); })
      .catch(() => {});
  }, [videoId]);

  if (!thumbUrl) return null;
  return <img src={thumbUrl} alt="" className={className} />;
}

// Thumbnail component for gallery strips - shows provider-appropriate preview
export function VideoThumbnail({ url, className = '' }: { url: string; className?: string }) {
  const provider = getVideoProvider(url);
  
  if (provider === 'youtube') {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
      return <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="" className={`w-full h-full object-cover ${className}`} />;
    }
  }
  
  if (provider === 'vimeo') {
    const videoId = getVimeoVideoId(url);
    if (videoId) {
      return <VimeoThumbnailImg videoId={videoId} className={`w-full h-full object-cover ${className}`} />;
    }
  }

  if (provider === 'dailymotion') {
    const videoId = getDailymotionVideoId(url);
    if (videoId) {
      return <img src={`https://www.dailymotion.com/thumbnail/video/${videoId}`} alt="" className={`w-full h-full object-cover ${className}`} />;
    }
  }

  if (provider === 'mp4') {
    const videoSrc = url.startsWith('http') ? url : getImageUrl(url);
    return (
      <video src={videoSrc} className={`w-full h-full object-cover ${className}`} muted preload="metadata" />
    );
  }
  
  // Unknown: dark placeholder
  return <div className={`w-full h-full bg-gray-800 ${className}`} />;
}
