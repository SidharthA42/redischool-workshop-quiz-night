// Demo mode for the presentation: choose questions in advance, then show them
// in large text. The audience answers out loud; you reveal the answer.
import { useState } from 'react'
import { CATEGORIES, type Category, type Question } from './questions'
import { loadDemoIds, makeRound, saveDemoIds, type Round } from './game'

const LETTERS = ['A', 'B', 'C', 'D']

export default function Demo({ questions, onBack }: { questions: Question[]; onBack: () => void }) {
  const [selected, setSelected] = useState<string[]>(() =>
    loadDemoIds().filter((id) => questions.some((q) => q.id === id)),
  )
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [rounds, setRounds] = useState<Round[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    setSelected(next)
    saveDemoIds(next)
  }

  function start() {
    const chosen = selected.map((id) => questions.find((q) => q.id === id)).filter((q): q is Question => !!q)
    setRounds(chosen.map(makeRound))
    setIndex(0)
    setRevealed(false)
  }

  // ---------- Presenting ----------
  if (rounds) {
    const round = rounds[index]
    const last = index === rounds.length - 1
    return (
      <section className="screen demo-show">
        <div className="game-bar-row">
          <button className="secondary small" onClick={() => setRounds(null)}>
            Exit demo
          </button>
          <p className="status">
            Question {index + 1} of {rounds.length}
          </p>
        </div>
        <article className="card demo-card flip" key={`${round.question.id}-${revealed}`}>
          <h2 className="question">{round.question.question}</h2>
          <ol className="options">
            {round.options.map((option, i) => (
              <li key={option}>
                <div
                  className={`option ${revealed ? (i === round.correctIndex ? 'right' : 'faded') : ''}`}
                >
                  <span className="key">{LETTERS[i]}</span>
                  <span>{option}</span>
                </div>
              </li>
            ))}
          </ol>
          {revealed && <p className="card-explanation">{round.question.explanation}</p>}
        </article>
        <div className="actions">
          {!revealed ? (
            <button className="primary" onClick={() => setRevealed(true)} autoFocus>
              Reveal the answer
            </button>
          ) : (
            <button
              className="primary"
              autoFocus
              onClick={() => {
                if (last) {
                  setRounds(null)
                } else {
                  setIndex(index + 1)
                  setRevealed(false)
                }
              }}
            >
              {last ? 'Finish the demo' : 'Next question'}
            </button>
          )}
        </div>
      </section>
    )
  }

  // ---------- Choosing questions ----------
  const visible = questions.filter((q) => category === 'all' || q.category === category)
  return (
    <section className="screen">
      <h1 className="page-title">Demo</h1>
      <p className="lead">
        Choose the questions for your presentation, in the order you want to show them. Three is a good number. Your
        choice is remembered in this browser.
      </p>

      <div className="demo-toolbar">
        <div className="text-field">
          <label htmlFor="demo-topic">Show topic</label>
          <select id="demo-topic" value={category} onChange={(e) => setCategory(e.target.value as Category | 'all')}>
            <option value="all">All topics</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <p className="status" aria-live="polite">
          {selected.length} selected
        </p>
      </div>

      <div className="actions">
        <button className="primary" onClick={start} disabled={selected.length === 0}>
          Start the demo
        </button>
        {selected.length > 0 && (
          <button
            className="secondary"
            onClick={() => {
              setSelected([])
              saveDemoIds([])
            }}
          >
            Clear selection
          </button>
        )}
        <button className="secondary" onClick={onBack}>
          Back to home
        </button>
      </div>

      <ul className="sheet demo-list">
        {visible.map((q) => {
          const position = selected.indexOf(q.id)
          return (
            <li key={q.id}>
              <label className="demo-option">
                <input type="checkbox" checked={position !== -1} onChange={() => toggle(q.id)} />
                <span className="demo-order" aria-hidden="true">
                  {position === -1 ? '' : position + 1}
                </span>
                <span>
                  <span className="demo-question">{q.question}</span>
                  <span className="demo-meta">
                    {q.category}, {q.difficulty}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
