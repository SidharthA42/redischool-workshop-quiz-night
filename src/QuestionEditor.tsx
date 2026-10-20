import { useState, type FormEvent } from 'react'
import { CATEGORIES, DIFFICULTIES, type Category, type Difficulty, type Question } from './questions'

type Props = {
  questions: Question[] // the player's own questions
  onChange: (questions: Question[]) => void
  onBack: () => void
}

const EMPTY_FORM = {
  question: '',
  correct: '',
  wrong: ['', '', ''] as [string, string, string],
  category: CATEGORIES[0] as Category,
  difficulty: DIFFICULTIES[0] as Difficulty,
  explanation: '',
}

export default function QuestionEditor({ questions, onChange, onBack }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')

  function validate() {
    const problems: string[] = []
    if (!form.question.trim()) problems.push('Write a question.')
    if (!form.correct.trim()) problems.push('Write the correct answer.')
    if (form.wrong.some((w) => !w.trim())) problems.push('Write all three wrong answers.')
    const answers = [form.correct, ...form.wrong].map((a) => a.trim().toLowerCase()).filter(Boolean)
    if (new Set(answers).size !== answers.length) problems.push('All four answers must be different.')
    return problems
  }

  function addQuestion(e: FormEvent) {
    e.preventDefault()
    const problems = validate()
    setErrors(problems)
    setMessage('')
    if (problems.length > 0) return
    const question: Question = {
      id: `custom-${Date.now()}`,
      category: form.category,
      difficulty: form.difficulty,
      question: form.question.trim(),
      correct: form.correct.trim(),
      wrong: form.wrong.map((w) => w.trim()) as [string, string, string],
      explanation: form.explanation.trim() || 'This question was added in the question editor.',
    }
    onChange([...questions, question])
    setForm({ ...EMPTY_FORM, category: form.category, difficulty: form.difficulty })
    setMessage('Question added. It can now appear in your games.')
  }

  function deleteQuestion(id: string) {
    onChange(questions.filter((q) => q.id !== id))
    setMessage('Question deleted.')
  }

  return (
    <section className="screen editor">
      <h1 className="page-title">Your questions</h1>
      <p className="lead">
        Questions you add here join the random pool. They are saved in this browser only.
      </p>

      <form className="sheet form" onSubmit={addQuestion} noValidate>
        <div className="text-field">
          <label htmlFor="new-question">Question</label>
          <textarea
            id="new-question"
            rows={2}
            maxLength={200}
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
          />
        </div>
        <div className="text-field">
          <label htmlFor="new-correct">Correct answer</label>
          <input
            id="new-correct"
            type="text"
            maxLength={120}
            value={form.correct}
            onChange={(e) => setForm({ ...form, correct: e.target.value })}
          />
        </div>
        {form.wrong.map((value, i) => (
          <div className="text-field" key={i}>
            <label htmlFor={`new-wrong-${i}`}>Wrong answer {i + 1}</label>
            <input
              id={`new-wrong-${i}`}
              type="text"
              maxLength={120}
              value={value}
              onChange={(e) => {
                const wrong: [string, string, string] = [...form.wrong]
                wrong[i] = e.target.value
                setForm({ ...form, wrong })
              }}
            />
          </div>
        ))}
        <div className="row">
          <div className="text-field">
            <label htmlFor="new-topic">Topic</label>
            <select id="new-topic" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="text-field">
            <label htmlFor="new-difficulty">Difficulty</label>
            <select
              id="new-difficulty"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-field">
          <label htmlFor="new-explanation">Explanation (optional, shown after answering)</label>
          <textarea
            id="new-explanation"
            rows={2}
            maxLength={300}
            value={form.explanation}
            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          />
        </div>

        {errors.length > 0 && (
          <ul className="error" role="alert">
            {errors.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {message && (
          <p className="note" role="status">
            {message}
          </p>
        )}

        <div className="actions">
          <button className="primary" type="submit">
            Add question
          </button>
          <button className="secondary" type="button" onClick={onBack}>
            Back to home
          </button>
        </div>
      </form>

      <h2 className="section-title">Added so far ({questions.length})</h2>
      {questions.length === 0 ? (
        <p className="lead">No questions yet. Fill in the form above to add your first one.</p>
      ) : (
        <ul className="sheet custom-list">
          {questions.map((q) => (
            <li key={q.id}>
              <div>
                <p className="review-question">{q.question}</p>
                <p className="custom-answer">{q.correct}</p>
                <div className="tags">
                  <span className="tag">{q.category}</span>
                  <span className="tag">{q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}</span>
                </div>
              </div>
              <button className="secondary small" onClick={() => deleteQuestion(q.id)} aria-label={`Delete: ${q.question}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
