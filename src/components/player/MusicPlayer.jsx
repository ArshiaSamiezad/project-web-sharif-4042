// Developer: Moeid Nadi - 402106683
import { useState, useCallback } from "react";
import { IoVolumeHigh, IoVolumeMute, IoVolumeLow, IoList } from "react-icons/io5";
import { usePlaying } from "../../context/PlayingContext";
import { normalizeTrack } from "../../utils/normalizeTrack";
import Controls from "./Controls";
import ProgressBar from "./ProgressBar";
import QueueList from "./QueueList";
import FullScreenPlayer from "./FullScreenPlayer";
import "./MusicPlayer.css";

function VolumeIcon({ volume, isMuted, size = 18 }) {
  if (isMuted || volume === 0) return <IoVolumeMute size={size} />;
  if (volume < 0.5) return <IoVolumeLow size={size} />;
  return <IoVolumeHigh size={size} />;
}

/**
 * MusicPlayer
 * Persistent bottom bar. On wide screens it's a 3-section grid; CSS alone
 * collapses it into a mini-player on narrow screens (no separate mobile
 * markup, so there's exactly one source of truth for layout).
 *
 * Clicking the cover art or track metadata opens FullScreenPlayer — on
 * both desktop and mobile.
 */
export default function MusicPlayer() {
  const player = usePlaying();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVolumeHovering, setIsVolumeHovering] = useState(false);

  const handleVolumeChange = useCallback(
    (e) => player.changeVolume(Number(e.target.value)),
    [player]
  );

  const track = normalizeTrack(player?.currentTrack);
  if (!track) return null;

  const volumePercent = player.isMuted ? 0 : player.volume * 100;

  return (
    <>
      <div className="music-player">
        {/* Track info — click cover or metadata to open the full-screen player */}
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          aria-label="نمایش پخش‌کننده تمام‌صفحه"
          className="music-player__track-btn"
        >
          <img src={track.coverImage} alt={track.title} className="music-player__cover" />
          <div className="music-player__meta">
            <p className="music-player__title">{track.title}</p>
            <p className="music-player__artist">{track.artistName}</p>
          </div>
        </button>

        {/* Controls + timeline (hidden on narrow screens) */}
        <div className="music-player__center">
          <Controls
            isPlaying={player.isPlaying}
            shuffle={player.shuffle}
            repeat={player.repeat}
            onTogglePlay={player.togglePlay}
            onNext={player.playNext}
            onPrev={player.playPrevious}
            onToggleShuffle={player.toggleShuffle}
            onCycleRepeat={player.cycleRepeat}
          />
          <ProgressBar currentTime={player.currentTime} duration={player.duration} onSeek={player.seek} />
        </div>

        {/* Volume + queue (hidden on narrow screens) */}
        <div className="music-player__right">
          <button
            type="button"
            onClick={player.toggleMute}
            aria-label="بی‌صدا کردن"
            className="music-player__icon-btn"
          >
            <VolumeIcon volume={player.volume} isMuted={player.isMuted} />
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.isMuted ? 0 : player.volume}
            onChange={handleVolumeChange}
            onMouseEnter={() => setIsVolumeHovering(true)}
            onMouseLeave={() => setIsVolumeHovering(false)}
            className="music-player__volume-track"
            style={{
              background: `linear-gradient(to right, ${
                isVolumeHovering ? "var(--color-illuminating)" : "var(--color-text)"
              } ${volumePercent}%, var(--color-stroke) ${volumePercent}%)`,
            }}
            aria-label="میزان صدا"
          />

          <div className="music-player__queue-wrap">
            <button
              type="button"
              onClick={() => setIsQueueOpen((o) => !o)}
              aria-pressed={isQueueOpen}
              aria-label="نمایش صف پخش"
              className={`music-player__icon-btn ${isQueueOpen ? "is-active" : ""}`}
            >
              <IoList size={20} />
            </button>
            <QueueList
              queue={player.queue}
              onRemove={player.removeFromQueue}
              isOpen={isQueueOpen}
              onClose={() => setIsQueueOpen(false)}
            />
          </div>
        </div>

        {/* Compact play/pause shortcut — only visible in the mini-player layout */}
        <button
          type="button"
          onClick={player.togglePlay}
          aria-label={player.isPlaying ? "توقف پخش" : "پخش"}
          className="music-player__mini-play"
        >
          <PlayPauseGlyph isPlaying={player.isPlaying} />
        </button>
      </div>

      <FullScreenPlayer isOpen={isExpanded} onClose={() => setIsExpanded(false)} />
    </>
  );
}

function PlayPauseGlyph({ isPlaying }) {
  return isPlaying ? (
    <span className="play-pause-glyph play-pause-glyph--pause">
      <span />
      <span />
    </span>
  ) : (
    <span className="play-pause-glyph play-pause-glyph--play" />
  );
}
