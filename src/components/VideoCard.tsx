import { Play } from "lucide-react";

interface VideoCardProps {
  videoUrl: string;
  onClick: () => void;
  thumbnailUrl?: string;
}

export function VideoCard({ videoUrl, onClick, thumbnailUrl }: VideoCardProps) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="relative rounded-[20px] overflow-hidden bg-black/40 group cursor-pointer w-full active:scale-95 transition-all duration-200"
    >
      <div className="relative select-none">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="w-full max-h-72 object-cover rounded-[20px]"
          />
        ) : (
          <div className="w-full h-60 bg-gradient-to-br from-purple-900/80 via-violet-800/60 to-indigo-900/80" />
        )}

        {/* Dark gradient at bottom for play button contrast */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/70 to-transparent rounded-b-[20px]" />

        {/* Play button badge */}
        <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-glass-active backdrop-blur-md flex items-center justify-center border-2 border-white/30 text-text-primary shadow-lg group-hover:scale-110 group-hover:bg-glass-active active:scale-90 transition-all duration-200">
          <Play size={20} className="fill-current text-text-primary ml-1" />
        </div>
      </div>
    </div>
  );
}
