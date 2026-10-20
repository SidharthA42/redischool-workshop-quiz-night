// Study mode: flip through the questions with their answers. No score.
import { useEffect, useState } from 'react'
import { CATEGORIES, DIFFICULTIES, type Category, type Difficulty, type Question } from './questions'
import { shuffle } from './game'

export default function Study({ questions, onBack }: { questions: Question[]; onBack: () => void }) {
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [difficulty, setDifficulty] = useState<Difficulty | 'any'>('any')
  const [order, setOrder] = useState<Question[]>(questions)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const cards = order.filter(
    (q) => (category === 'all' || q.category === category) && (difficulty === 'any' || q.difficulty === difficulty),
  )
  const card = cards[Math.min(index, cards.length - 1)]

  function go(step: number) {
    if (cards.length === 0) return
    setIndex((index + step + cards.length) % cards.length)
    setFlipped(false)
  }

  // Left and right arrow keys move between cards.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <section className="screen">
      <h1 className="page-title">Study cards</h1>
      <p className="lead">Read the question, think of your answer, then turn the card over.</p>

      <div className="row filters">
        <div className="text-field">
          <label htmlFor="study-topic">Topic</label>
          <select
            id="study-topic"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as Category | 'all')
              setIndex(0)
              setFlipped(false)
            }}
          >
            <option value="all">All topics</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="text-field">
          <label htmlFor="study-difficulty">Difficulty</label>
          <select
            id="study-difficulty"
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value as Difficulty | 'any')
              setIndex(0)
              setFlipped(false)
            }}
          >
            <option value="any">Any difficulty</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {card ? (
        <>
          <p className="status">
            Card {Math.min(index, cards.length - 1) + 1} of {cards.length}
          </p>
          <div className={`deck stack-${Math.min(2, cards.length - 1)}`}>
            {flipped ? (
              <article className="card card-back flip" key={`${card.id}-back`}>
                <p className="card-kicker">The answer</p>
                <p className="card-answer">{card.correct}</p>
                <p className="card-explanation">{card.explanation}</p>
              </article>
            ) : (
              <article className="card flip" key={`${card.id}-front`}>
                <div className="tags">
                  <span className="tag">{card.category}</span>
                  <span className={`tag level-${card.difficulty}`}>
                    {card.difficulty.charAt(0).toUpperCase() + card.difficulty.slice(1)}
                  </span>
                </div>
                <h2 className="question">{card.question}</h2>
                <ul className="study-options">
                  {[card.correct, ...card.wrong].sort().map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ul>
              </article>
            )}
          </div>
          <div className="actions">
            <button className="primary" onClick={() => setFlipped(!flipped)} autoFocus>
              {flipped ? 'Show the question' : 'Show the answer'}
            </button>
            <button className="secondary" onClick={() => go(-1)}>
              Previous
            </button>
            <button className="secondary" onClick={() => go(1)}>
              Next
            </button>
            <button
              className="secondary"
              onClick={() => {
                setOrder(shuffle(order))
                setIndex(0)
                setFlipped(false)
              }}
            >
              Shuffle
            </button>
          </div>
          <p className="hint">Tip: use the left and right arrow keys to move between cards.</p>
        </>
      ) : (
        <p className="lead">No questions match. Pick another topic or difficulty.</p>
      )}

      <button className="link" onClick={onBack}>
        Back to home
      </button>
    </section>
  )
}
