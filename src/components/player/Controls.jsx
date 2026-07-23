// Developer: Moeid Nadi - 402106683
import { IoShuffle, IoPlaySkipBack, IoPlay, IoPause, IoPlaySkipForward, IoRepeat } from "react-icons/io5";
import "./Controls.css";

/**
 * Controls — play/pause, skip, shuffle, repeat (pure CSS, no Tailwind).
 * @param {boolean} isPlaying
 * @param {boolean} shuffle
 * @param {0|1|2} repeat
 * @param {"md"|"sm"} size - "sm" always shows shuffle/repeat (used in the expanded player)
 */
export default function Controls({
  isPlaying,
  shuffle,
  repeat,
  onTogglePlay,
  onNext,
  onPrev,
  onToggleShuffle,
  onCycleRepeat,
  size = "md",
}) {
  return (
    <div className={`controls controls--${size}`}>
      <button
        type="button"
        onClick={onToggleShuffle}
        aria-pressed={shuffle}
        aria-label="پخش تصادفی"
        className={`controls__icon-btn controls__icon-btn--secondary ${shuffle ? "is-active" : ""}`}
      >
        <IoShuffle size={16} />
      </button>

      <button type="button" onClick={onPrev} aria-label="آهنگ قبلی" className="controls__icon-btn">
        <IoPlaySkipBack size={18} />
      </button>

      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "توقف پخش" : "پخش"}
        className="controls__play-btn"
      >
        {isPlaying ? <IoPause size={18} /> : <IoPlay size={18} className="controls__play-icon" />}
      </button>

      <button type="button" onClick={onNext} aria-label="آهنگ بعدی" className="controls__icon-btn">
        <IoPlaySkipForward size={18} />
      </button>

      <button
        type="button"
        onClick={onCycleRepeat}
        aria-pressed={repeat !== 0}
        aria-label="حالت تکرار"
        className={`controls__icon-btn controls__icon-btn--secondary controls__repeat ${
          repeat !== 0 ? "is-active" : ""
        }`}
      >
        <IoRepeat size={16} />
        {repeat === 2 && <span className="controls__repeat-badge">1</span>}
      </button>
    </div>
  );
}
