// Developer: Moeid Nadi - 402106683
import { useState, useCallback, useEffect, useRef } from "react";
import { IoVolumeHigh, IoVolumeMute, IoVolumeLow, IoList, IoCloseSharp } from "react-icons/io5";
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
 *
 * The bar can also be dismissed via a close button. Dismissal plays a
 * slide-down/fade-out transition before unmounting, and optionally stops
 * playback. `isVisible` is the single source of truth for visibility —
 * nothing but the dismiss button and the track-change effect below is
 * allowed to touch it, so unrelated re-renders (context updates, playback
 * state changes, parent re-renders) can't flip it. A `useEffect` watches
 * the active track's id and resets `isVisible` to true whenever it
 * changes — whether that's a song picked from an album/playlist, the
 * queue auto-advancing, or anything else in the app starting playback —
 * so the bar reliably reappears for the new track even after being
 * dismissed for a previous one.
 */
export default function MusicPlayer() {
  const player = usePlaying();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVolumeHovering, setIsVolumeHovering] = useState(false);
  // Single source of truth for visibility. Whether the bar is currently
  // dismissed. Nothing except the dismiss button (setting it to false) or
  // the track-change effect below (resetting it to true) is allowed to
  // touch this — not context updates, not playback state changes, not
  // parent re-renders.
  const [isVisible, setIsVisible] = useState(true);
  const [isHiding, setIsHiding] = useState(false);

  const track = normalizeTrack(player?.currentTrack);
  const trackId = track?.id ?? track?.trackId ?? track?.title;

  // Keep track of the previous track id so the effect below only fires on
  // an actual change (including the very first track ever loading), not on
  // unrelated re-renders where trackId happens to be the same value.
  const prevTrackIdRef = useRef(trackId);

  // Whenever a new track becomes active — whether that's the user clicking
  // a song in an album/playlist, the queue auto-advancing, or anything else
  // in the app triggering playback — bring the bar back if it had been
  // dismissed for a previous track.
  useEffect(() => {
    if (trackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current = trackId;
      if (trackId != null) {
        setIsVisible(true);
        setIsHiding(false);
      }
    }
  }, [trackId]);

  const handleVolumeChange = useCallback(
    (e) => player.changeVolume(Number(e.target.value)),
    [player]
  );

  const handleDismiss = useCallback(
    (e) => {
      // Stop the click from bubbling up to any parent handler (e.g. a
      // track-row click, a shell-level listener) that could otherwise
      // trigger unrelated state updates/re-renders at the same time.
      e.stopPropagation();

      // Only trigger the slide-down/fade-out here. We deliberately do NOT
      // set isVisible to false yet — that happens in handleTransitionEnd,
      // once the animation has actually finished. This keeps the bar
      // mounted (and thus able to keep animating) for the duration of
      // the transition, no matter what else re-renders in the meantime.
      setIsHiding(true);

      // Stop/pause audio playback when the bar is dismissed. This may
      // cause the parent/context to re-render — that's fine, since
      // visibility is now driven only by isHiding/isVisible, neither of
      // which this re-render can touch.
      if (typeof player.stopPlayback === "function") {
        player.stopPlayback();
      } else if (typeof player.pause === "function") {
        player.pause();
      } else if (player.isPlaying && typeof player.togglePlay === "function") {
        player.togglePlay();
      }
    },
    [player]
  );

  const handleTransitionEnd = useCallback(
    (e) => {
      // Only react to the transform/opacity transition on the bar itself,
      // not on children (e.g. the volume slider thumb) that also transition.
      if (e.target !== e.currentTarget) return;
      if (!isHiding) return;
      // Animation finished — now it's safe to actually unmount.
      setIsVisible(false);
    },
    [isHiding]
  );

  if (!track || !isVisible) return null;

  const volumePercent = player.isMuted ? 0 : player.volume * 100;

  return (
    <>
      <div
        className={`music-player ${isHiding ? "music-player--hiding" : ""}`}
        onTransitionEnd={handleTransitionEnd}
      >
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

        {/* Volume + queue + dismiss (hidden on narrow screens, except dismiss) */}
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

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="بستن پخش‌کننده"
            className="music-player__icon-btn music-player__dismiss"
          >
            <IoCloseSharp size={20} />
          </button>
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

        {/* Compact dismiss shortcut — only visible in the mini-player layout */}
        <button
          type="button"
          onClick={(e) => handleDismiss(e)}
          aria-label="بستن پخش‌کننده"
          className="music-player__mini-dismiss"
        >
          <IoCloseSharp size={16} />
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