// Developer: Moeid Nadi - 402106683
import { FaTrash } from "react-icons/fa6";
import { useI18n } from "../../i18n/I18nProvider";
import { normalizeTrack } from "../../utils/normalizeTrack";
import "./QueueList.css";

/**
 * QueueList — desktop dropdown popup showing upcoming tracks.
 * @param {Array} queue
 * @param {(index: number) => void} onRemove
 * @param {boolean} isOpen
 * @param {() => void} onClose
 */
export default function QueueList({ queue = [], onRemove, isOpen, onClose }) {
  const { t } = useI18n();

  if (!isOpen || queue.length === 0) return null;

  return (
    <>
      <div className="queue-list__backdrop" onClick={onClose} aria-hidden="true" />

      <div role="dialog" aria-label={t("player.queue")} className="queue-list">
        <div className="queue-list__header">
          <h3 className="queue-list__title">{t("player.nextInQueue")}</h3>
          <span className="queue-list__count">{t("common.trackCount", { count: queue.length })}</span>
        </div>

        <ul className="queue-list__items">
          {queue.map((rawTrack, index) => {
            const track = normalizeTrack(rawTrack);
            return (
              <li key={`${track.id ?? index}-${index}`} className="queue-list__item">
                <img src={track.coverImage} alt={track.title} className="queue-list__cover" />
                <div className="queue-list__meta">
                  <p className="queue-list__song">{track.title}</p>
                  <p className="queue-list__artist">{track.artistName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove?.(index)}
                  aria-label={t("player.removeFromQueue", { title: track.title })}
                  className="queue-list__remove"
                >
                  <FaTrash size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
