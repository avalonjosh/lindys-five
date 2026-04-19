'use client';

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  playlistId?: string;
}

export default function YouTubeEmbed({ videoId, title, playlistId }: YouTubeEmbedProps) {
  const src = playlistId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?list=${encodeURIComponent(playlistId)}`
    : `https://www.youtube-nocookie.com/embed/${videoId}`;

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}
