// Developer: Moeid Nadi - 402106683
import { useState, useCallback } from "react";
import "./ProgressBar.css";

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * ProgressBar — custom interactive seek bar (pure CSS, no Tailwind).
 * @param {number} currentTime
 * @param {number} duration
 * @param {(time: number) => void} onSeek
 */
export default function ProgressBar({ currentTime = 0, duration = 0, onSeek, className = "" }) {
  const [isHovering, setIsHovering] = useState(false);
  const [dragValue, setDragValue] = useState(null);

  const displayTime = dragValue !== null ? dragValue : currentTime;
  const percent = duration > 0 ? Math.min((displayTime / duration) * 100, 100) : 0;

  const handleChange = useCallback((e) => setDragValue(Number(e.target.value)), []);
  const commit = useCallback(
    (e) => {
      onSeek?.(Number(e.target.value));
      setDragValue(null);
    },
    [onSeek]
  );

  return (
    <div className={`progress-bar ${className}`}dir="ltr">
      <span className="progress-bar__time progress-bar__time--start">{formatTime(displayTime)}</span>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={displayTime}
        onChange={handleChange}
        onMouseUp={commit}
        onTouchEnd={commit}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="progress-bar__track"
        style={{
          background: `linear-gradient(to right, ${
            isHovering ? "var(--color-illuminating)" : "var(--color-text)"
          } ${percent}%, var(--color-stroke) ${percent}%)`,
        }}
        aria-label="جستجوی زمان پخش"
      />

      <span className="progress-bar__time progress-bar__time--end">{formatTime(duration)}</span>
    </div>
  );
}
