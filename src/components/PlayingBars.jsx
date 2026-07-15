export default function PlayingBars({ className = '' }) {
  return (
    <span className={`playing-bars ${className}`.trim()} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}
