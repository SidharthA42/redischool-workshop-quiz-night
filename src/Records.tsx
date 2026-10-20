// The high-score list and the topic stats screen. Both are saved in this browser only.
import { useState } from 'react'
import { CATEGORIES } from './questions'
import type { HighScore, TopicStats } from './game'

// A "Clear" button that asks once more before deleting.
function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button className="secondary" onClick={() => setConfirming(true)}>
        {label}
      </button>
    )
  }
  return (
    <>
      <button
        className="secondary danger"
        onClick={() => {
          onClear()
          setConfirming(false)
        }}
      >
        Yes, clear it
      </button>
      <button className="secondary" onClick={() => setConfirming(false)}>
        Keep it
      </button>
    </>
  )
}

export function HighScores(props: { scores: HighScore[]; onClear: () => void; onBack: () => void }) {
  return (
    <section className="screen">
      <h1 className="page-title">High scores</h1>
      {props.scores.length === 0 ? (
        <p className="lead">No scores yet. Finish a game and your score lands here.</p>
      ) : (
        <>
          <p className="lead">The best ten games in this browser. Bonus points count too.</p>
          <ol className="sheet score-list">
            {props.scores.map((s, i) => (
              <li key={s.id}>
                <span className="score-place">{i + 1}</span>
                <span className="score-who">
                  <strong>{s.name}</strong>
                  <span className="score-detail">
                    {s.correct} of {s.total} right. {s.settings}. {new Date(s.date).toLocaleDateString()}
                  </span>
                </span>
                <span className="score-total">{s.points}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="actions">
        <button className="primary" onClick={props.onBack}>
          Back to home
        </button>
        {props.scores.length > 0 && <ClearButton label="Clear list" onClear={props.onClear} />}
      </div>
    </section>
  )
}

export function TopicStatsView(props: { stats: TopicStats; onClear: () => void; onBack: () => void }) {
  const total = (name: string) =>
    Object.values(props.stats[name] ?? {}).reduce((sum, c) => sum + (c?.answered ?? 0), 0)
  const names = Object.keys(props.stats)
    .filter((name) => total(name) > 0)
    .sort((a, b) => total(b) - total(a))

  return (
    <section className="screen">
      <h1 className="page-title">Topic stats</h1>
      {names.length === 0 ? (
        <p className="lead">No stats yet. Play a game and your results per topic show up here.</p>
      ) : (
        <>
          <p className="lead">Right answers per topic for every player name, from all games in this browser.</p>
          {names.map((name) => {
            const perTopic = props.stats[name]
            const rated = CATEGORIES.filter((c) => (perTopic[c]?.answered ?? 0) > 0).map((c) => ({
              topic: c,
              share: perTopic[c]!.correct / perTopic[c]!.answered,
            }))
            rated.sort((a, b) => b.share - a.share)
            const best = rated[0]
            const worst = rated[rated.length - 1]
            return (
              <article key={name} className="sheet stats-card">
                <h2 className="stats-name">{name}</h2>
                <ul className="stats-list">
                  {CATEGORIES.map((topic) => {
                    const count = perTopic[topic]
                    const share = count && count.answered > 0 ? count.correct / count.answered : 0
                    return (
                      <li key={topic}>
                        <span className="stats-topic">{topic}</span>
                        <span className="meter" aria-hidden="true">
                          <span className="meter-fill" style={{ width: `${share * 100}%` }} />
                        </span>
                        <span className="stats-count">
                          {count ? `${count.correct} of ${count.answered} right` : 'Not played yet'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {rated.length >= 2 && best.share > worst.share && (
                  <p className="stats-summary">
                    Strongest: {best.topic}. Practise more: {worst.topic}.
                  </p>
                )}
              </article>
            )
          })}
        </>
      )}
      <div className="actions">
        <button className="primary" onClick={props.onBack}>
          Back to home
        </button>
        {names.length > 0 && <ClearButton label="Clear stats" onClear={props.onClear} />}
      </div>
    </section>
  )
}
