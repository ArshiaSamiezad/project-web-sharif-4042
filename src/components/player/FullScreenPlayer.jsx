// Developer: Moeid Nadi - 402106683
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { IoChevronDown, IoVolumeHigh, IoVolumeLow, IoVolumeMute, IoListSharp } from "react-icons/io5";
import { FaMicrophone } from "react-icons/fa6";
import { useAuth } from "../../context/AuthContext";
import { usePlaying } from "../../context/PlayingContext";
import { normalizeTrack } from "../../utils/normalizeTrack";
import Controls from "./Controls";
import ProgressBar from "./ProgressBar";
import Lyrics from "./Lyrics";
import QueuePanel from "./QueuePanel";
import "./FullScreenPlayer.css";

const CLOSE_ANIMATION_MS = 320;

function formatCount(num) {
  if (num == null) return null;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(num);
}

function VolumeIcon({ volume, isMuted, size = 18 }) {
  if (isMuted || volume === 0) return <IoVolumeMute size={size} />;
  if (volume < 0.5) return <IoVolumeLow size={size} />;
  return <IoVolumeHigh size={size} />;
}

/**
 * FullScreenPlayer
 * Immersive "now playing" overlay, opened from MusicPlayer.jsx by clicking
 * the cover art or track metadata (desktop AND mobile). Reads playback
 * state directly from PlayingContext, and self-portals to document.body so
 * it renders at the true root — never trapped inside an ancestor's
 * backdrop-filter / transform containing block.
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 */
export default function FullScreenPlayer({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  const player = usePlaying();
  const [view, setView] = useState("cover"); // "cover" | "lyrics"
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isVolumeHovering, setIsVolumeHovering] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Mount immediately on open (so the enter transition can play), but delay
  // unmounting on close until the exit transition finishes.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), CLOSE_ANIMATION_MS);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!mounted) {
      setView("cover");
      setIsQueueOpen(false);
    }
  }, [mounted]);

  const track = normalizeTrack(player?.currentTrack);
  if (!mounted || !track) return null;

  const isGold = currentUser?.subscription === "gold";
  const volumePercent = player.isMuted ? 0 : player.volume * 100;
  const hasStats = track.listenersCount != null || track.streamsCount != null;

  const overlay = (
    <div className={`full-screen-player ${visible ? "is-visible" : ""}`} role="dialog" aria-modal="true">
      <div
        className="full-screen-player__backdrop"
        style={{ backgroundImage: `url(${track.coverImage})` }}
        aria-hidden="true"
      />
      <div className="full-screen-player__tint" aria-hidden="true" />

      <div className="full-screen-player__content">
        <div className="full-screen-player__header">
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پخش‌کننده"
            className="full-screen-player__close"
          >
            <IoChevronDown size={26} />
          </button>

          <div className="full-screen-player__from">
            <p className="full-screen-player__from-label">در حال پخش از آلبوم</p>
            {track.albumId ? (
              <Link
                to={`/album/${track.albumId}`}
                onClick={onClose}
                className="full-screen-player__from-link"
              >
                {track.albumName ?? "آلبوم نامشخص"}
              </Link>
            ) : (
              <span className="full-screen-player__from-link full-screen-player__from-link--static">
                {track.albumName ?? "تک‌آهنگ"}
              </span>
            )}
          </div>

          <span className="full-screen-player__spacer" aria-hidden="true" />
        </div>

        <div className="full-screen-player__stage">
          {view === "cover" ? (
            <img src={track.coverImage} alt={track.title} className="full-screen-player__cover" />
          ) : (
            <Lyrics lyrics={track.lyrics} title={track.title} />
          )}
        </div>

        <div className="full-screen-player__meta">
          <p className="full-screen-player__title">{track.title}</p>
          {track.artistId ? (
            <Link
              to={`/artist/${track.artistId}`}
              onClick={onClose}
              className="full-screen-player__artist"
            >
              {track.artistName}
            </Link>
          ) : (
            <p className="full-screen-player__artist full-screen-player__artist--static">
              {track.artistName}
            </p>
          )}

          {isGold && hasStats && (
            <div className="full-screen-player__stats">
              <span className="full-screen-player__gold-badge">طلایی</span>
              {track.listenersCount != null && (
                <span>{formatCount(track.listenersCount)} شنونده ماهانه</span>
              )}
              {track.streamsCount != null && <span>· {formatCount(track.streamsCount)} پخش</span>}
            </div>
          )}
        </div>

        <div className="full-screen-player__progress">
          <ProgressBar currentTime={player.currentTime} duration={player.duration} onSeek={player.seek} />
        </div>

        <div className="full-screen-player__controls">
          <Controls
            isPlaying={player.isPlaying}
            shuffle={player.shuffle}
            repeat={player.repeat}
            onTogglePlay={player.togglePlay}
            onNext={player.playNext}
            onPrev={player.playPrevious}
            onToggleShuffle={player.toggleShuffle}
            onCycleRepeat={player.cycleRepeat}
            size="sm"
          />
        </div>

        <div className="full-screen-player__utility">
          <button
            type="button"
            onClick={() => setView((v) => (v === "lyrics" ? "cover" : "lyrics"))}
            aria-pressed={view === "lyrics"}
            aria-label="نمایش متن ترانه"
            className={`full-screen-player__utility-btn ${view === "lyrics" ? "is-active" : ""}`}
          >
            <FaMicrophone size={16} />
          </button>

          <div className="full-screen-player__volume">
            <button
              type="button"
              onClick={player.toggleMute}
              aria-label="بی‌صدا کردن"
              className="full-screen-player__utility-btn"
            >
              <VolumeIcon volume={player.volume} isMuted={player.isMuted} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.isMuted ? 0 : player.volume}
              onChange={(e) => player.changeVolume(Number(e.target.value))}
              onMouseEnter={() => setIsVolumeHovering(true)}
              onMouseLeave={() => setIsVolumeHovering(false)}
              className="full-screen-player__volume-track"
              style={{
                background: `linear-gradient(to right, ${
                  isVolumeHovering ? "var(--color-illuminating)" : "var(--color-text)"
                } ${volumePercent}%, rgba(255,255,255,0.22) ${volumePercent}%)`,
              }}
              aria-label="میزان صدا"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsQueueOpen(true)}
            aria-pressed={isQueueOpen}
            aria-label="باز کردن صف پخش"
            className="full-screen-player__utility-btn"
          >
            <IoListSharp size={20} />
          </button>
        </div>
      </div>

      {isQueueOpen && (
        <QueuePanel
          currentTrack={track}
          queue={player.queue}
          onRemove={player.removeFromQueue}
          onClose={() => setIsQueueOpen(false)}
        />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
