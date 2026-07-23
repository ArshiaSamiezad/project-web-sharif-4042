// Developer: Moeid Nadi - 402106683
import { useI18n } from "../../i18n/I18nProvider";
import "./Lyrics.css";

/**
 * Lyrics — shows the current track's lyrics, or a fallback message.
 * @param {string} lyrics
 * @param {string} title
 */
export default function Lyrics({ lyrics, title }) {
  const { t } = useI18n();

  if (!lyrics || !lyrics.trim()) {
    return (
      <div className="lyrics lyrics--empty">
        <p>{t("player.noLyricsFor", { title })}</p>
      </div>
    );
  }

  const lines = lyrics.split("\n");

  return (
    <div className="lyrics">
      {lines.map((line, i) => (
        <p key={i} className={line.trim() ? "lyrics__line" : "lyrics__line lyrics__line--blank"}>
          {line}
        </p>
      ))}
    </div>
  );
}
