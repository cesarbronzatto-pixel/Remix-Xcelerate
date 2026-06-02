import React, { useRef, useEffect, useState } from 'react';
import ReactPlayer from 'react-player';
import { Maximize, Minimize, AlertCircle, Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw, Settings, ExternalLink } from 'lucide-react';
import { getEmbedUrl, getDirectVideoUrl } from '../utils/videoUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoPlayerProps {
  src: string;
  onProgress?: (percentage: number, currentTime: number) => void;
  onComplete?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onToggleFullScreen?: () => void;
  isFullScreen?: boolean;
  initialTime?: number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  onProgress, 
  onComplete,
  onPlay,
  onPause,
  onToggleFullScreen,
  isFullScreen,
  initialTime = 0,
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSeeked = useRef(false);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const embedUrl = React.useMemo(() => getEmbedUrl(src), [src]);
  const [internalFullScreen, setInternalFullScreen] = useState(false);
  const isCurrentlyFullScreen = isFullScreen !== undefined ? isFullScreen : internalFullScreen;

  useEffect(() => {
    const handleFullScreenChange = () => {
      if (isFullScreen === undefined) {
        setInternalFullScreen(!!document.fullscreenElement);
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, [isFullScreen]);

  const handleToggleFullScreen = () => {
    if (onToggleFullScreen) {
      onToggleFullScreen();
    } else {
      if (!document.fullscreenElement && containerRef.current) {
        containerRef.current.requestFullscreen().catch(err => {
          console.error(`Erro ao tentar entrar em tela cheia: ${err.message}`);
        });
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
  };
  const baseDirectUrl = React.useMemo(() => getDirectVideoUrl(src), [src]);
  const hasTriggeredPlay = useRef(false);
  
  // Determine if we can use our custom ReactPlayer wrapper
  const canUseCustomPlayer = React.useMemo(() => {
    // ReactPlayer has native support for YouTube, Vimeo, and direct files (mp4/webm).
    // We avoid Google Drive here because it requires a raw iframe or proxy.
    if (!src) return false;
    if (src.includes('drive.google.com') || src.includes('googledrive.com')) return false;
    // We can use it for YouTube, Vimeo, or actual video files
    return true;
  }, [src]);

  useEffect(() => {
    setHasError(false);
    setUseFallback(false);
    hasSeeked.current = false;
    hasTriggeredPlay.current = false;
    setPlayed(0);
    setIsPlaying(false);
  }, [src]);

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      if (container) container.removeEventListener('mousemove', handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const handleReady = () => {
    if (initialTime > 0 && !hasSeeked.current && playerRef.current) {
      playerRef.current.seekTo(initialTime, 'seconds');
      hasSeeked.current = true;
    }
  };

  const handleError = (e: any) => {
    console.error("VideoPlayer Error:", e);
    // If custom player fails, fallback to iframe
    if (canUseCustomPlayer && !useFallback) {
      setUseFallback(true);
    } else {
      setHasError(true);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) onPlay?.();
    else onPause?.();
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayed(val);
    playerRef.current?.seekTo(val);
  };

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh) {
      return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  if (!src) {
    return (
      <div className={`relative w-full ${isCurrentlyFullScreen ? 'h-full' : 'aspect-video'} rounded-2xl overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-6 text-center border border-slate-800 shadow-2xl`}>
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h3 className="text-white font-bold mb-2">Vídeo não configurado</h3>
        <p className="text-slate-400 text-sm">Este módulo ainda não possui um link de vídeo válido.</p>
      </div>
    );
  }

  // If it's a YouTube, Vimeo, or direct URL, use our custom player UI
  if (canUseCustomPlayer && !hasError && !useFallback) {
    return (
      <div 
        ref={containerRef}
        className={`relative w-full ${isCurrentlyFullScreen ? 'h-full' : 'aspect-video'} rounded-2xl overflow-hidden bg-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 group transition-all duration-500`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <ReactPlayer
          ref={playerRef}
          url={src}
          width="100%"
          height="100%"
          style={{ pointerEvents: 'none' }}
          playing={isPlaying}
          volume={volume}
          muted={isMuted}
          onReady={handleReady}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={onComplete}
          onError={handleError}
          onDuration={(d) => setDuration(d)}
          onProgress={(state: any) => {
            if (!isSeeking) {
              setPlayed(state.played);
              const percentage = Math.floor(state.played * 100);
              onProgress?.(percentage, state.playedSeconds);
            }
          }}
          config={{
            file: {
              attributes: {
                controlsList: 'nodownload',
                disablePictureInPicture: true,
                className: 'w-full h-full object-contain'
              }
            },
            youtube: {
              playerVars: {
                showinfo: 0,
                modestbranding: 1,
                rel: 0,
                disablekb: 1,
                controls: 0,
                fs: 0
              }
            }
          }}
        />

        {/* Global clickable area for play/pause */}
        <div 
          className="absolute inset-0 z-10 cursor-pointer" 
          onClick={togglePlay} 
        />

        {/* Custom Controls Overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"
            >
              {/* Center Play/Pause Large Icon */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.button
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePlay}
                  className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white pointer-events-auto shadow-2xl"
                >
                  {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                </motion.button>
              </div>

              {/* Bottom Control Bar */}
              <div className="p-6 pointer-events-auto">
                {/* Progress Bar */}
                <div className="relative group/progress mb-4">
                  <input
                    type="range"
                    min={0}
                    max={0.999999}
                    step="any"
                    value={played}
                    onMouseDown={() => setIsSeeking(true)}
                    onChange={handleSeekChange}
                    onMouseUp={() => setIsSeeking(false)}
                    className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all"
                  />
                  <div 
                    className="absolute top-0 left-0 h-1.5 bg-indigo-500 rounded-full pointer-events-none transition-all group-hover/progress:h-2"
                    style={{ width: `${played * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <button onClick={togglePlay} className="text-white hover:text-indigo-400 transition-colors">
                      {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>
                    
                    <div className="flex items-center gap-3 group/volume">
                      <button onClick={() => setIsMuted(!isMuted)} className="text-white hover:text-indigo-400 transition-colors">
                        {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step="any"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          setVolume(parseFloat(e.target.value));
                          setIsMuted(false);
                        }}
                        className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-white/20 rounded-full appearance-none accent-white cursor-pointer"
                      />
                    </div>

                    <div className="text-white/80 text-xs font-mono tracking-wider">
                      {formatTime(played * duration)} <span className="text-white/30 mx-1">/</span> {formatTime(duration)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button className="text-white/60 hover:text-white transition-colors">
                      <Settings className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleToggleFullScreen}
                      className="text-white hover:text-indigo-400 transition-colors"
                    >
                      {isCurrentlyFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (hasError) {
    const isDrive = src.includes('drive.google.com') || src.includes('googledrive.com');
    return (
      <div className={`relative w-full ${isCurrentlyFullScreen ? 'h-full' : 'aspect-video'} rounded-2xl overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-6 text-center border border-slate-800 shadow-2xl`}>
        <AlertCircle className={`w-12 h-12 ${isDrive ? 'text-indigo-400' : 'text-red-500'} mb-4`} />
        <h3 className="text-white font-bold mb-2">
          {isDrive ? 'Vídeo do Google Drive Restrito' : 'Erro ao reproduzir vídeo'}
        </h3>
        <p className="text-slate-400 text-sm max-w-md">
          {isDrive 
            ? 'O vídeo não pôde ser carregado. Certifique-se de que a permissão de compartilhamento no Google Drive está definida como "Qualquer pessoa com o link".' 
            : 'Não foi possível carregar o vídeo. Verifique se o link é válido ou se você tem permissão para acessá-lo.'}
        </p>
        
        {isDrive ? (
          <a 
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 px-6 py-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir no Google Drive
          </a>
        ) : (
          <button 
            onClick={() => {
              setHasError(false);
              setUseFallback(true);
            }}
            className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10"
          >
            Tentar modo de compatibilidade
          </button>
        )}
      </div>
    );
  }

  // Fallback to Iframe (YouTube, Vimeo, or large Google Drive files)
  return (
    <div 
      ref={containerRef}
      className={`relative w-full ${isCurrentlyFullScreen ? 'h-full' : 'aspect-video'} rounded-2xl overflow-hidden bg-slate-950 shadow-2xl border border-slate-800/50 group`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <iframe
        key={embedUrl}
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={() => {
          if (!hasTriggeredPlay.current) {
            onPlay?.();
            hasTriggeredPlay.current = true;
          }
        }}
      ></iframe>

      {/* Invisible Protective Overlay for Google Drive Pop-out Button */}
      {src.includes('drive.google.com') && (
        <div className="absolute top-0 right-0 w-16 h-16 z-20 pointer-events-auto cursor-default bg-transparent" />
      )}
    </div>
  );
};
