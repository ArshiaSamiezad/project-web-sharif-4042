// Developer: Moeid Nadi - 402106683
import { IoChevronDown } from "react-icons/io5";
import { FaTrash } from "react-icons/fa6";
import { normalizeTrack } from "../../utils/normalizeTrack";
import "./QueuePanel.css";

/**
 * QueuePanel — full-sheet queue view rendered inside FullScreenPlayer.
 * @param {object} currentTrack - already-normalized track
 * @param {Array} queue
 * @param {(index: number) => void} onRemove
 * @param {() => void} onClose
 */
export default function QueuePanel({ currentTrack, queue = [], onRemove, onClose }) {
  return (
    <div className="queue-panel">
      <div className="queue-panel__header">
        <h2 className="queue-panel__title">صف پخش</h2>
        <button type="button" onClick={onClose} aria-label="بستن صف" className="queue-panel__close">
          <IoChevronDown size={22} />
        </button>
      </div>

      <div className="queue-panel__body">
        {currentTrack && (
          <>
            <p className="queue-panel__section-label queue-panel__section-label--active">در حال پخش</p>
            <div className="queue-panel__now">
              <img src={currentTrack.coverImage} alt={currentTrack.title} className="queue-panel__cover" />
              <div className="queue-panel__meta">
                <p className="queue-panel__song queue-panel__song--active">{currentTrack.title}</p>
                <p className="queue-panel__artist">{currentTrack.artistName}</p>
              </div>
            </div>
          </>
        )}

        {queue.length > 0 ? (
          <>
            <p className="queue-panel__section-label">بعدی</p>
            <ul className="queue-panel__list">
              {queue.map((rawTrack, index) => {
                const track = normalizeTrack(rawTrack);
                return (
                  <li key={`${track.id ?? index}-${index}`} className="queue-panel__item">
                    <img src={track.coverImage} alt={track.title} className="queue-panel__cover" />
                    <div className="queue-panel__meta">
                      <p className="queue-panel__song">{track.title}</p>
                      <p className="queue-panel__artist">{track.artistName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove?.(index)}
                      aria-label={`حذف ${track.title} از صف`}
                      className="queue-panel__remove"
                    >
                      <FaTrash size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="queue-panel__empty">صف پخش خالی است.</p>
        )}
      </div>
    </div>
  );
}
