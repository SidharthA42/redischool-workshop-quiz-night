import { useEffect, useState } from 'react'
import { CATEGORIES, DIFFICULTIES, QUESTIONS, type Question } from './questions'
import {
  addHighScores,
  clearHighScores,
  clearStats,
  freshFirst,
  loadCustomQuestions,
  loadHighScores,
  loadSettings,
  loadSoundSetting,
  loadStats,
  makeRound,
  markSeen,
  recordStats,
  saveCustomQuestions,
  saveSettings,
  saveSoundSetting,
  shuffle,
  type HighScore,
  type Round,
  type Settings,
} from './game'
import { launchConfetti, playSound, type Sound } from './effects'
import QuestionEditor from './QuestionEditor'
import Study from './Study'
import Demo from './Demo'
import { HighScores, TopicStatsView } from './Records'

const SECONDS_PER_QUESTION = 20
const BONUS_WITHIN_SECONDS = 10 // a right answer in the first 10 seconds earns a speed bonus
const EXTRA_SECONDS = 10 // the "+10 s" lifeline
const STREAK_LENGTH = 3 // every 3rd right answer in a row earns a streak bonus
const LENGTHS = [5, 10, 15] as const
const LETTERS = ['A', 'B', 'C', 'D']

type Mode = 'solo' | 'duel' | 'challenge'

const MODES: Record<Mode, { name: string; players: 1 | 2; blurb: string; rules: string[] }> = {
  solo: {
    name: 'Solo',
    players: 1,
    blurb: 'Just you. Random questions, at your own pace or against the clock.',
    rules: [
      'Every right answer is worth 1 point.',
      `${STREAK_LENGTH} right answers in a row add a streak bonus point.`,
      'Lifelines, once each per game: 50:50 removes two wrong answers, Skip swaps the question, +10 s adds time.',
    ],
  },
  duel: {
    name: 'Duel',
    players: 2,
    blurb: 'Two players take turns on one laptop. Miss a question and the other player can steal the point.',
    rules: [
      'Players take turns, each with their own random questions.',
      'After a wrong answer, the other player may steal: pick one of the remaining answers for 1 point.',
      `Streak bonus for every ${STREAK_LENGTH} right answers in a row. Lifelines: 50:50, Skip and +10 s, once each per player.`,
    ],
  },
  challenge: {
    name: 'Challenge',
    players: 2,
    blurb: 'Choose a question for your opponent from three cards. If they get it wrong, you score.',
    rules: [
      'Before each turn, the other player sees three questions (no answers) and picks one.',
      'Right answer: +1 for the player answering. Wrong answer: +1 for the player who picked it.',
      `Streak bonus for every ${STREAK_LENGTH} right answers in a row. Lifelines: 50:50 and +10 s, once each per player.`,
    ],
  },
}

type Screen =
  | 'home'
  | 'setup'
  | 'pick'
  | 'handoff'
  | 'question'
  | 'result'
  | 'scores'
  | 'stats'
  | 'editor'
  | 'study'
  | 'demo'

// One game in progress.
type Game = {
  mode: Mode
  players: string[]
  perPlayer: number // questions per player
  timer: boolean
  label: string // describes the settings on the high-score list
  pool: Question[] // the questions this game draws from
  retry: boolean // a "retry my mistakes" round
}

// Every score event is worth 1 point.
type Reason = 'right' | 'speed' | 'streak' | 'steal' | 'picker'
type ScoreEvent = { player: number; reason: Reason }

// The question being played right now.
type Turn = {
  player: number
  round: Round
  hidden: number[] // answers removed by 50:50
  chosen: number | null // the answer picked
  timedOut: boolean
  earned: Reason[] // points the player earned on this question
  steal: 'offer' | 'active' | 'done' | null // Duel only
  stealChosen: number | null
}

// A finished question, for the review list, stats and "retry my mistakes".
type Played = {
  player: number
  question: Question
  correct: boolean
  yourAnswer: string | null // null = time ran out
  stolenBy: number | null
}

type Lifelines = { fifty: boolean; skip: boolean; time: boolean } // true = still available

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [mode, setMode] = useState<Mode>('solo')
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [customQuestions, setCustomQuestions] = useState<Question[]>(loadCustomQuestions)
  const [highScores, setHighScores] = useState<HighScore[]>(loadHighScores)
  const [stats, setStats] = useState(loadStats)
  const [soundOn, setSoundOn] = useState(loadSoundSetting)

  // ---------- The game in progress ----------
  const [game, setGame] = useState<Game | null>(null)
  const [turnNo, setTurnNo] = useState(0)
  const [turn, setTurn] = useState<Turn | null>(null)
  const [pickCards, setPickCards] = useState<Question[]>([])
  const [usedIds, setUsedIds] = useState<string[]>([])
  const [played, setPlayed] = useState<Played[]>([])
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [streaks, setStreaks] = useState([0, 0])
  const [lifelines, setLifelines] = useState<Lifelines[]>([])
  const [explainOpen, setExplainOpen] = useState(false)
  const [newPlaces, setNewPlaces] = useState<(number | null)[]>([])

  // ---------- Countdown ----------
  const [startedAt, setStartedAt] = useState(0)
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(0)
  const [timeLimit, setTimeLimit] = useState(SECONDS_PER_QUESTION)

  const allQuestions = [...QUESTIONS, ...customQuestions]

  // ---------- Setup screen ----------
  const setupPlayers = MODES[mode].players
  const setupPool = filterPool(allQuestions, settings)
  const setupPerPlayer = Math.min(settings.length, Math.floor(setupPool.length / setupPlayers))
  const setupNames = namesFor(settings, setupPlayers)
  let setupError = ''
  if (setupPerPlayer < 1) setupError = 'No questions match these choices. Pick another topic or difficulty.'
  else if (setupPlayers === 2 && setupNames[0].toLowerCase() === setupNames[1].toLowerCase())
    setupError = 'Give the two players different names.'

  // ---------- Current question ----------
  const answered = turn !== null && (turn.chosen !== null || turn.timedOut)
  const answeredRight = turn !== null && turn.chosen === turn.round.correctIndex
  // The right answer is shown once nobody can answer any more.
  const revealed = answered && (answeredRight || turn.steal === null || turn.steal === 'done')
  const timerRunning = screen === 'question' && !!game?.timer && turn !== null && !answered
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  const totalTurns = game ? game.perPlayer * game.players.length : 0

  function sound(name: Sound) {
    if (soundOn) playSound(name)
  }

  // The countdown clock ticks while a question waits for an answer.
  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [timerRunning])

  // Time is up: the question counts as a wrong answer.
  useEffect(() => {
    if (timerRunning && now >= deadline) resolveAnswer(null)
  })

  // Keyboard: A–D or 1–4 picks an answer (also when stealing).
  useEffect(() => {
    const canAnswer = screen === 'question' && turn !== null && (!answered || turn.steal === 'active')
    if (!canAnswer) return
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      let option = ['a', 'b', 'c', 'd'].indexOf(key)
      if (option === -1) option = ['1', '2', '3', '4'].indexOf(key)
      if (option !== -1) answer(option)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------- Game flow ----------

  function startGame(gameMode: Mode, s: Settings, retryQuestions?: Question[]) {
    const players = MODES[gameMode].players
    const pool = retryQuestions ?? filterPool(allQuestions, s)
    const perPlayer = retryQuestions ? retryQuestions.length : Math.min(s.length, Math.floor(pool.length / players))
    if (perPlayer < 1) return
    const newGame: Game = {
      mode: gameMode,
      players: namesFor(s, players),
      perPlayer,
      timer: s.timer,
      label: describeGame(gameMode, s, perPlayer),
      pool,
      retry: retryQuestions !== undefined,
    }
    setGame(newGame)
    setPlayed([])
    setEvents([])
    setStreaks([0, 0])
    setUsedIds([])
    setNewPlaces([])
    setLifelines(newGame.players.map(() => ({ fifty: true, skip: gameMode !== 'challenge', time: s.timer })))
    beginTurn(newGame, 0, [])
  }

  function beginTurn(g: Game, number: number, used: string[]) {
    setTurnNo(number)
    setExplainOpen(false)
    const player = number % g.players.length
    if (g.mode === 'challenge') {
      // The other player picks this question from three cards.
      setTurn(null)
      setPickCards(freshFirst(g.pool, used).slice(0, 3))
      setScreen('pick')
      return
    }
    startQuestion(g, player, freshFirst(g.pool, used)[0], used)
    if (g.mode === 'duel') {
      setScreen('handoff')
    } else {
      startClock()
      setScreen('question')
    }
  }

  function startQuestion(g: Game, player: number, question: Question, used: string[]) {
    markSeen(g.pool, [question.id])
    setUsedIds([...used, question.id])
    setExplainOpen(false)
    setTurn({
      player,
      round: makeRound(question),
      hidden: [],
      chosen: null,
      timedOut: false,
      earned: [],
      steal: null,
      stealChosen: null,
    })
  }

  function startClock() {
    const t = Date.now()
    setStartedAt(t)
    setNow(t)
    setDeadline(t + SECONDS_PER_QUESTION * 1000)
    setTimeLimit(SECONDS_PER_QUESTION)
  }

  function pickQuestion(question: Question) {
    if (!game) return
    startQuestion(game, turnNo % 2, question, usedIds)
    setScreen('handoff')
  }

  function ready() {
    startClock()
    setScreen('question')
  }

  function answer(option: number) {
    if (!game || !turn || turn.hidden.includes(option)) return
    if (turn.steal === 'active') {
      // The other player tries to steal the point.
      if (option === turn.chosen) return
      const right = option === turn.round.correctIndex
      if (right) setEvents([...events, { player: 1 - turn.player, reason: 'steal' }])
      setTurn({ ...turn, steal: 'done', stealChosen: option })
      sound(right ? 'right' : 'wrong')
      return
    }
    if (answered) return
    resolveAnswer(option)
  }

  // option = null means the time ran out.
  function resolveAnswer(option: number | null) {
    if (!game || !turn) return
    const player = turn.player
    const right = option !== null && option === turn.round.correctIndex
    const earned: Reason[] = []
    const nextStreaks = [...streaks]
    if (right) {
      earned.push('right')
      if (game.timer && Date.now() - startedAt < BONUS_WITHIN_SECONDS * 1000) earned.push('speed')
      nextStreaks[player] += 1
      if (nextStreaks[player] % STREAK_LENGTH === 0) earned.push('streak')
    } else {
      nextStreaks[player] = 0
    }
    const added: ScoreEvent[] = earned.map((reason) => ({ player, reason }))
    if (!right && game.mode === 'challenge') added.push({ player: 1 - player, reason: 'picker' })

    // Steal is only worth offering if at least two answers are left to choose from.
    const answersLeft = 4 - turn.hidden.length - (option === null ? 0 : 1)
    const offerSteal = !right && game.mode === 'duel' && answersLeft >= 2

    setStreaks(nextStreaks)
    setEvents([...events, ...added])
    setTurn({ ...turn, chosen: option, timedOut: option === null, earned, steal: offerSteal ? 'offer' : null })
    sound(right ? 'right' : 'wrong')
  }

  function spendLifeline(kind: keyof Lifelines) {
    if (!turn) return
    setLifelines(lifelines.map((l, i) => (i === turn.player ? { ...l, [kind]: false } : l)))
  }

  function takeFifty() {
    if (!turn || answered) return
    const wrong = [0, 1, 2, 3].filter((i) => i !== turn.round.correctIndex)
    setTurn({ ...turn, hidden: shuffle(wrong).slice(0, 2) })
    spendLifeline('fifty')
  }

  function takeSkip() {
    if (!game || !turn || answered) return
    const next = freshFirst(game.pool, usedIds)[0]
    if (!next) return
    spendLifeline('skip')
    startQuestion(game, turn.player, next, usedIds)
    startClock()
  }

  function takeExtraTime() {
    if (!turn || answered) return
    setDeadline(deadline + EXTRA_SECONDS * 1000)
    setTimeLimit(timeLimit + EXTRA_SECONDS)
    spendLifeline('time')
  }

  function nextTurn() {
    if (!game || !turn) return
    const stolen = turn.steal === 'done' && turn.stealChosen === turn.round.correctIndex
    const record: Played = {
      player: turn.player,
      question: turn.round.question,
      correct: answeredRight,
      yourAnswer: turn.chosen === null ? null : turn.round.options[turn.chosen],
      stolenBy: stolen ? 1 - turn.player : null,
    }
    const allPlayed = [...played, record]
    setPlayed(allPlayed)
    if (turnNo + 1 >= totalTurns) finishGame(game, allPlayed)
    else beginTurn(game, turnNo + 1, usedIds)
  }

  function finishGame(g: Game, allPlayed: Played[]) {
    setTurn(null)
    const totals = g.players.map((_, p) => pointsOf(events, p))
    const corrects = g.players.map((_, p) => allPlayed.filter((a) => a.player === p && a.correct).length)
    setStats(
      recordStats(allPlayed.map((a) => ({ name: g.players[a.player], category: a.question.category, correct: a.correct }))),
    )
    if (g.retry) {
      setNewPlaces([])
    } else {
      setNewPlaces(
        addHighScores(
          g.players.map((name, p) => ({
            name,
            points: totals[p],
            correct: corrects[p],
            total: g.perPlayer,
            settings: g.label,
          })),
        ),
      )
      setHighScores(loadHighScores())
    }
    setScreen('result')
    sound('finish')
    const perfect = g.players.length === 1 && corrects[0] === g.perPlayer
    const hasWinner = g.players.length === 2 && totals[0] !== totals[1]
    if (perfect || hasWinner) launchConfetti()
  }

  function quitGame() {
    setGame(null)
    setTurn(null)
    setScreen('home')
  }

  function updateSettings(s: Settings) {
    setSettings(s)
    saveSettings(s)
  }

  function toggleSound() {
    saveSoundSetting(!soundOn)
    setSoundOn(!soundOn)
  }

  function updateCustomQuestions(questions: Question[]) {
    saveCustomQuestions(questions)
    setCustomQuestions(questions)
  }

  // ---------- Screens ----------

  const gameBar = game && (
    <GameBar
      game={game}
      events={events}
      streaks={streaks}
      turnNo={turnNo}
      done={played.length}
      total={totalTurns}
      activePlayer={turnNo % game.players.length}
      onQuit={quitGame}
    />
  )

  return (
    <div className="app">
      <header className="topbar">
        {screen === 'home' ? <span /> : <span className="brand">Quiz Night</span>}
        <button className="link" onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? 'Sound on' : 'Sound off'}
        </button>
      </header>

      <main>
        {screen === 'home' && (
          <section className="screen home">
            <h1 className="title">Quiz Night</h1>
            <p className="lead">Test what you know about LLMs, tokens, context windows and AI agents.</p>

            <h2 className="section-title">Play</h2>
            <ul className="mode-list">
              {(Object.keys(MODES) as Mode[]).map((m) => (
                <li key={m}>
                  <button
                    className="mode-card"
                    onClick={() => {
                      setMode(m)
                      setScreen('setup')
                    }}
                  >
                    <span className="mode-name">{MODES[m].name}</span>
                    <span className="mode-players">{MODES[m].players === 1 ? '1 player' : '2 players, one laptop'}</span>
                    <span className="mode-blurb">{MODES[m].blurb}</span>
                  </button>
                </li>
              ))}
            </ul>

            <h2 className="section-title">Learn and present</h2>
            <ul className="mode-list pair">
              <li>
                <button className="mode-card" onClick={() => setScreen('study')}>
                  <span className="mode-name">Study cards</span>
                  <span className="mode-blurb">Flip through every question with its answer and explanation. No score.</span>
                </button>
              </li>
              <li>
                <button className="mode-card" onClick={() => setScreen('demo')}>
                  <span className="mode-name">Demo</span>
                  <span className="mode-blurb">Choose questions for your presentation and show them in large text.</span>
                </button>
              </li>
            </ul>

            <nav className="home-links" aria-label="More">
              <button className="link" onClick={() => setScreen('scores')}>
                High scores
              </button>
              <button className="link" onClick={() => setScreen('stats')}>
                Topic stats
              </button>
              <button className="link" onClick={() => setScreen('editor')}>
                Edit questions
              </button>
            </nav>
          </section>
        )}

        {screen === 'setup' && (
          <section className="screen setup-screen">
            <h1 className="page-title">{MODES[mode].name}</h1>
            <ul className="rules">
              {MODES[mode].rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>

            <form
              className="sheet form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!setupError) startGame(mode, settings)
              }}
            >
              <div className="row">
                {setupNames.map((_, i) => (
                  <div key={i} className="text-field">
                    <label htmlFor={`player-${i + 1}-name`}>
                      {setupPlayers === 1 ? 'Your name (for the high-score list)' : `Player ${i + 1} name`}
                    </label>
                    <input
                      id={`player-${i + 1}-name`}
                      type="text"
                      maxLength={20}
                      placeholder={`Player ${i + 1}`}
                      value={settings.names[i]}
                      onChange={(e) => {
                        const names: [string, string] = [...settings.names]
                        names[i] = e.target.value
                        updateSettings({ ...settings, names })
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="row">
                <div className="text-field">
                  <label htmlFor="topic">Topic</label>
                  <select
                    id="topic"
                    value={settings.category}
                    onChange={(e) => updateSettings({ ...settings, category: e.target.value as Settings['category'] })}
                  >
                    <option value="all">All topics</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-field">
                  <label htmlFor="difficulty">Difficulty</label>
                  <select
                    id="difficulty"
                    value={settings.difficulty}
                    onChange={(e) =>
                      updateSettings({ ...settings, difficulty: e.target.value as Settings['difficulty'] })
                    }
                  >
                    <option value="any">Any difficulty</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {capitalize(d)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <fieldset className="field">
                <legend>Questions per player</legend>
                <div className="segmented">
                  {LENGTHS.map((n) => (
                    <label key={n}>
                      <input
                        type="radio"
                        name="length"
                        checked={settings.length === n}
                        onChange={() => updateSettings({ ...settings, length: n })}
                      />
                      <span>{n}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.timer}
                  onChange={(e) => updateSettings({ ...settings, timer: e.target.checked })}
                />
                <span>
                  Countdown: {SECONDS_PER_QUESTION} seconds per question, and a speed bonus point for a right answer
                  in the first {BONUS_WITHIN_SECONDS} seconds
                </span>
              </label>

              {!setupError && setupPerPlayer < settings.length && (
                <p className="note">
                  Only {setupPool.length} questions match, so {setupPlayers === 2 ? 'each player gets' : 'this game has'}{' '}
                  {setupPerPlayer}.
                </p>
              )}
              {setupError && (
                <p className="error" role="alert">
                  {setupError}
                </p>
              )}

              <div className="actions">
                <button className="primary" type="submit" disabled={setupError !== ''} autoFocus>
                  Start
                </button>
                <button className="secondary" type="button" onClick={() => setScreen('home')}>
                  Back to home
                </button>
              </div>
            </form>
          </section>
        )}

        {screen === 'pick' && game && (
          <section className="screen">
            {gameBar}
            <div className="pick-intro">
              <h1 className="page-title small">
                {game.players[1 - (turnNo % 2)]}, choose a question for {game.players[turnNo % 2]}
              </h1>
              <p className="lead">
                {game.players[turnNo % 2]}, look away! If {game.players[turnNo % 2]} gets it wrong,{' '}
                {game.players[1 - (turnNo % 2)]} scores a point.
              </p>
            </div>
            <ul className="pick-list">
              {pickCards.map((q) => (
                <li key={q.id}>
                  <button className="pick-card" onClick={() => pickQuestion(q)}>
                    <span className="tags">
                      <span className="tag">{q.category}</span>
                      <span className={`tag level-${q.difficulty}`}>{capitalize(q.difficulty)}</span>
                    </span>
                    <span className="pick-question">{q.question}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {screen === 'handoff' && game && turn && (
          <section className="screen">
            {gameBar}
            <div className="sheet handoff">
              <p className="lead">Pass the laptop to</p>
              <h1 className="title">{game.players[turn.player]}</h1>
              <p className="lead">
                Question {questionNumberFor(game, turnNo)} of {game.perPlayer}
                {game.timer && `. The ${SECONDS_PER_QUESTION}-second countdown starts when you are ready.`}
              </p>
              <button className="primary" onClick={ready} autoFocus>
                I'm ready
              </button>
            </div>
          </section>
        )}

        {screen === 'question' && game && turn && (
          <section className="screen">
            {gameBar}

            {game.timer && (
              <div className={`timer ${secondsLeft <= 5 && !answered ? 'low' : ''}`}>
                <div className="timer-track">
                  <div
                    className="timer-fill"
                    style={{ width: `${Math.min(100, (secondsLeft / timeLimit) * 100)}%` }}
                  />
                </div>
                <span aria-label={`${secondsLeft} seconds left`}>{secondsLeft} s</span>
              </div>
            )}

            <div className={`deck stack-${Math.min(2, totalTurns - turnNo - 1)}`}>
              {explainOpen && revealed ? (
                <article className="card card-back flip" key={`${turn.round.question.id}-back`}>
                  <p className="card-kicker">The answer</p>
                  <p className="card-answer">
                    {LETTERS[turn.round.correctIndex]}. {turn.round.question.correct}
                  </p>
                  <p className="card-explanation">{turn.round.question.explanation}</p>
                </article>
              ) : (
                <article className="card flip" key={`${turn.round.question.id}-front`}>
                  <div className="tags">
                    <span className="tag">{turn.round.question.category}</span>
                    <span className={`tag level-${turn.round.question.difficulty}`}>
                      {capitalize(turn.round.question.difficulty)}
                    </span>
                  </div>
                  <h2 className="question">{turn.round.question.question}</h2>
                  <ol className="options">
                    {turn.round.options.map((option, i) => (
                      <li key={option}>
                        <button
                          className={`option ${optionState(turn, i, revealed)}`}
                          onClick={() => answer(i)}
                          disabled={
                            turn.hidden.includes(i) ||
                            (answered && turn.steal !== 'active') ||
                            (turn.steal === 'active' && i === turn.chosen)
                          }
                          aria-label={turn.hidden.includes(i) ? `${LETTERS[i]}: removed by 50:50` : undefined}
                        >
                          <span className="key">{LETTERS[i]}</span>
                          <span>{option}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </article>
              )}
            </div>

            {!answered && (
              <div className="lifelines" role="group" aria-label="Lifelines">
                <LifelineButton label="50:50" available={lifelines[turn.player]?.fifty} onClick={takeFifty} />
                {game.mode !== 'challenge' && (
                  <LifelineButton
                    label="Skip"
                    available={lifelines[turn.player]?.skip && game.pool.some((q) => !usedIds.includes(q.id))}
                    onClick={takeSkip}
                  />
                )}
                {game.timer && (
                  <LifelineButton
                    label={`+${EXTRA_SECONDS} s`}
                    available={lifelines[turn.player]?.time}
                    onClick={takeExtraTime}
                  />
                )}
                <span className="hint">Press A–D or 1–4 to answer.</span>
              </div>
            )}

            {turn.steal === 'offer' && (
              <div className="panel steal" role="status">
                <p className="verdict wrong">{turn.timedOut ? "Time's up!" : 'Not quite.'}</p>
                <p>
                  {game.players[1 - turn.player]}, do you want to steal the point? Pick one of the remaining answers.
                </p>
                <div className="actions">
                  <button className="primary" onClick={() => setTurn({ ...turn, steal: 'active' })} autoFocus>
                    Steal
                  </button>
                  <button className="secondary" onClick={() => setTurn({ ...turn, steal: 'done' })}>
                    No steal
                  </button>
                </div>
              </div>
            )}

            {turn.steal === 'active' && (
              <div className="panel steal" role="status">
                <p className="verdict">{game.players[1 - turn.player]} is stealing</p>
                <p>Pick one of the remaining answers for 1 point.</p>
              </div>
            )}

            {revealed && (
              <div className={`panel feedback ${answeredRight ? 'right' : 'wrong'}`} role="status">
                <p className={`verdict ${answeredRight ? 'right' : 'wrong'}`}>{verdict(turn)}</p>
                {feedbackDetails(game, turn).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <div className="actions">
                  {!answeredRight && (
                    <button className="primary" onClick={() => setExplainOpen(!explainOpen)} aria-pressed={explainOpen}>
                      {explainOpen ? 'Back to the question' : 'Explain the answer'}
                    </button>
                  )}
                  <button className={answeredRight ? 'primary' : 'secondary'} onClick={nextTurn} autoFocus>
                    {turnNo + 1 >= totalTurns
                      ? 'See the result'
                      : game.players.length === 2
                        ? 'Next player'
                        : 'Next question'}
                  </button>
                  {answeredRight && (
                    <button className="secondary" onClick={() => setExplainOpen(!explainOpen)} aria-pressed={explainOpen}>
                      {explainOpen ? 'Back to the question' : 'Explain the answer'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {screen === 'result' && game && (
          <section className="screen">
            <div className="sheet result">
              <Result game={game} played={played} events={events} newPlaces={newPlaces} />
              <div className="actions">
                <button className="primary" onClick={() => startGame(game.mode, settings)} autoFocus>
                  {game.players.length === 2 ? 'Rematch' : 'Play again'}
                </button>
                {game.players.length === 1 && played.some((p) => !p.correct) && (
                  <button
                    className="secondary"
                    onClick={() =>
                      startGame(
                        'solo',
                        settings,
                        played.filter((p) => !p.correct).map((p) => p.question),
                      )
                    }
                  >
                    Retry my mistakes ({played.filter((p) => !p.correct).length})
                  </button>
                )}
                <button className="secondary" onClick={() => setScreen('home')}>
                  Home
                </button>
              </div>
              {newPlaces.some((p) => p !== null) && (
                <button className="link" onClick={() => setScreen('scores')}>
                  See the high-score list
                </button>
              )}
            </div>
            <Review game={game} played={played} />
          </section>
        )}

        {screen === 'scores' && (
          <HighScores
            scores={highScores}
            onClear={() => {
              clearHighScores()
              setHighScores([])
            }}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'stats' && (
          <TopicStatsView
            stats={stats}
            onClear={() => {
              clearStats()
              setStats({})
            }}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'editor' && (
          <QuestionEditor
            questions={customQuestions}
            onChange={updateCustomQuestions}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'study' && <Study questions={allQuestions} onBack={() => setScreen('home')} />}

        {screen === 'demo' && <Demo questions={allQuestions} onBack={() => setScreen('home')} />}
      </main>
    </div>
  )
}

// ---------- Pieces of the screen ----------

function GameBar(props: {
  game: Game
  events: ScoreEvent[]
  streaks: number[]
  turnNo: number
  done: number
  total: number
  activePlayer: number
  onQuit: () => void
}) {
  const { game, events, streaks, activePlayer } = props
  const [confirming, setConfirming] = useState(false)
  const two = game.players.length === 2
  const number = questionNumberFor(game, props.turnNo)
  const status = two
    ? `${game.players[activePlayer]}'s turn, question ${number} of ${game.perPlayer}`
    : `${game.retry ? 'Retry round, question' : 'Question'} ${number} of ${game.perPlayer}`

  return (
    <div className="game-bar">
      <div className="game-bar-row">
        {confirming ? (
          <div className="quit-confirm" role="group" aria-label="Quit this game?">
            <span>Quit this game?</span>
            <button className="secondary small danger" onClick={props.onQuit}>
              Yes, quit
            </button>
            <button className="secondary small" onClick={() => setConfirming(false)} autoFocus>
              Keep playing
            </button>
          </div>
        ) : (
          <button className="secondary small" onClick={() => setConfirming(true)}>
            Quit
          </button>
        )}
        <div className="scores">
          {game.players.map((name, p) => (
            <div key={name} className={`score ${two && p === activePlayer ? 'active' : ''}`}>
              <span className="score-name">{two ? name : 'Score'}</span>
              <span className="score-points bump" key={pointsOf(events, p)}>
                {pointsOf(events, p)}
              </span>
              {streaks[p] >= 2 && <span className="streak">{streaks[p]} in a row</span>}
            </div>
          ))}
        </div>
      </div>
      <p className="status">{status}</p>
      <div
        className="progress"
        role="progressbar"
        aria-label="Game progress"
        aria-valuemin={0}
        aria-valuemax={props.total}
        aria-valuenow={props.done}
      >
        <div className="progress-fill" style={{ width: `${(props.done / props.total) * 100}%` }} />
      </div>
    </div>
  )
}

function LifelineButton(props: { label: string; available: boolean | undefined; onClick: () => void }) {
  return (
    <button
      className={`lifeline ${props.available ? '' : 'used'}`}
      onClick={props.onClick}
      disabled={!props.available}
      aria-label={props.available ? `Lifeline ${props.label}` : `Lifeline ${props.label}, used`}
    >
      {props.label}
    </button>
  )
}

function Result(props: { game: Game; played: Played[]; events: ScoreEvent[]; newPlaces: (number | null)[] }) {
  const { game, played, events, newPlaces } = props
  const correctOf = (p: number) => played.filter((a) => a.player === p && a.correct).length

  const notes = game.players
    .map((name, p) => {
      const place = newPlaces[p]
      if (!place) return null
      const solo = game.players.length === 1
      return place === 1
        ? `New top score! ${solo ? 'You lead' : `${name} leads`} the high-score list.`
        : `${solo ? 'You' : name} made place ${place} on the high-score list.`
    })
    .filter((n): n is string => n !== null)

  if (game.players.length === 1) {
    const correct = correctOf(0)
    const points = pointsOf(events, 0)
    return (
      <>
        <p className="result-label">{game.retry ? 'Retry round' : 'Your score'}</p>
        <p className="big-score">
          {correct} of {game.perPlayer}
        </p>
        {points !== correct && <p className="lead">{breakdown(events, 0, correct)}</p>}
        <p className="lead">{scoreMessage(correct, game.perPlayer)}</p>
        {notes.map((n) => (
          <p key={n} className="note">
            {n}
          </p>
        ))}
      </>
    )
  }

  const totals = [pointsOf(events, 0), pointsOf(events, 1)]
  const headline = totals[0] === totals[1] ? "It's a tie!" : `${game.players[totals[0] > totals[1] ? 0 : 1]} wins!`
  return (
    <>
      <p className="result-label">Final score</p>
      <h1 className="title">{headline}</h1>
      <ul className="player-results">
        {game.players.map((name, p) => (
          <li key={name}>
            <span className="player-name">{name}</span>
            <span className="player-points">{totals[p]}</span>
            <span className="player-detail">{breakdown(events, p, correctOf(p), game.perPlayer)}</span>
          </li>
        ))}
      </ul>
      {notes.map((n) => (
        <p key={n} className="note">
          {n}
        </p>
      ))}
    </>
  )
}

function Review({ game, played }: { game: Game; played: Played[] }) {
  return (
    <details className="sheet review">
      <summary>Review the answers</summary>
      <ol>
        {played.map((a, i) => (
          <li key={i} className={a.correct ? 'right' : 'wrong'}>
            <p className="review-question">
              {game.players.length === 2 && <strong>{game.players[a.player]}: </strong>}
              {a.question.question}
            </p>
            <p>
              {a.correct ? 'Right: ' : 'Correct answer: '}
              {a.question.correct}
            </p>
            {!a.correct && (
              <p className="review-yours">
                {a.yourAnswer === null ? 'Time ran out.' : `Answer given: ${a.yourAnswer}`}
                {a.stolenBy !== null && ` ${game.players[a.stolenBy]} stole the point.`}
              </p>
            )}
            <p className="review-explanation">{a.question.explanation}</p>
          </li>
        ))}
      </ol>
    </details>
  )
}

// ---------- Small helpers ----------

function filterPool(questions: Question[], s: Settings) {
  return questions.filter(
    (q) =>
      (s.category === 'all' || q.category === s.category) && (s.difficulty === 'any' || q.difficulty === s.difficulty),
  )
}

function namesFor(s: Settings, players: number) {
  return s.names.slice(0, players).map((name, i) => name.trim() || `Player ${i + 1}`)
}

function describeGame(mode: Mode, s: Settings, perPlayer: number) {
  const topic = s.category === 'all' ? 'all topics' : s.category
  const level = s.difficulty === 'any' ? 'any difficulty' : s.difficulty
  return `${MODES[mode].name}, ${topic}, ${level}, ${perPlayer} questions${s.timer ? ', countdown' : ''}`
}

// Which question number (1, 2, 3 …) this turn is for its own player.
function questionNumberFor(game: Game, turnNo: number) {
  return Math.floor(turnNo / game.players.length) + 1
}

function pointsOf(events: ScoreEvent[], player: number) {
  return events.filter((e) => e.player === player).length
}

const EXTRA_POINTS: [Exclude<Reason, 'right'>, string, string][] = [
  ['speed', 'speed bonus', 'speed bonuses'],
  ['streak', 'streak bonus', 'streak bonuses'],
  ['steal', 'steal', 'steals'],
  ['picker', 'picker point', 'picker points'],
]

// For example "4 right + 1 speed bonus + 1 streak bonus = 6 points".
function breakdown(events: ScoreEvent[], player: number, correct: number, total?: number) {
  const parts = [total === undefined ? `${correct} right` : `${correct} of ${total} right`]
  for (const [reason, one, many] of EXTRA_POINTS) {
    const n = events.filter((e) => e.player === player && e.reason === reason).length
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`)
  }
  const points = pointsOf(events, player)
  return `${parts.join(' + ')} = ${points} ${points === 1 ? 'point' : 'points'}`
}

function optionState(turn: Turn, i: number, revealed: boolean) {
  if (turn.hidden.includes(i)) return 'removed'
  if (revealed) {
    if (i === turn.round.correctIndex) return 'right'
    if (i === turn.chosen || i === turn.stealChosen) return 'wrong'
    return 'faded'
  }
  if (turn.chosen !== null && i === turn.chosen) return 'wrong' // shown while the other player may steal
  return ''
}

function verdict(turn: Turn) {
  const answer = `The answer is ${LETTERS[turn.round.correctIndex]}.`
  if (turn.chosen === turn.round.correctIndex) return 'Correct!'
  if (turn.timedOut) return `Time's up! ${answer}`
  return `Not quite. ${answer}`
}

function feedbackDetails(game: Game, turn: Turn) {
  const lines: string[] = []
  const name = game.players[turn.player]
  const other = game.players[1 - turn.player]
  if (turn.earned.length > 0) {
    const bits = ['+1 point']
    if (turn.earned.includes('speed')) bits.push('+1 speed bonus')
    if (turn.earned.includes('streak')) bits.push(`+1 streak bonus for ${STREAK_LENGTH} in a row`)
    lines.push(game.players.length === 2 ? `${name}: ${bits.join(', ')}` : bits.join(', '))
  }
  if (game.mode === 'challenge' && turn.chosen !== turn.round.correctIndex) lines.push(`${other} gets a picker point.`)
  if (turn.steal === 'done') {
    if (turn.stealChosen === turn.round.correctIndex) lines.push(`${other} stole the point!`)
    else if (turn.stealChosen !== null) lines.push(`${other} tried to steal, but missed too.`)
  }
  return lines
}

function scoreMessage(score: number, total: number) {
  if (score === total) return 'Perfect round. You really know your tokens.'
  if (score >= total * 0.6) return 'Solid result. Play again for new questions.'
  return 'Every round teaches something. Open the review below, or retry your mistakes.'
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
