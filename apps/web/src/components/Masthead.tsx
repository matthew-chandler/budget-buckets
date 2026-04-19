function formatToday(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function Masthead() {
  const today = formatToday()
  const issue = 'VOL. I · NO. 01'

  return (
    <header className="masthead">
      <div className="masthead__inner">
        <div className="masthead__mark">
          <span className="masthead__mark-logo" aria-hidden />
          <span className="masthead__mark-title">Budget Buckets</span>
        </div>
        <div className="masthead__tag">A Public Ledger of Municipal Spending</div>
        <div className="masthead__meta">
          <span>{issue}</span>
          <span aria-label="today">{today}</span>
        </div>
      </div>
    </header>
  )
}
