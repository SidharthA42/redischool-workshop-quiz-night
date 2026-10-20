// Game helpers: shuffling, choosing fresh questions, and everything the app
// remembers in browser storage (seen questions, settings, high scores,
// topic stats, custom questions, demo questions, sound).
import { CATEGORIES, DIFFICULTIES, type Category, type Difficulty, type Question } from './questions'

// Returns a shuffled copy of a list (Fisher–Yates shuffle).
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ---------- Browser storage ----------
// Storage can be blocked (for example in private windows), so every
// read and write is wrapped in try/catch and the app keeps working without it.

function readStored<T>(key: string, fallback: T, isValid: (value: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    return isValid(value) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is not available: the app still works, it just won't remember.
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStringList = (value: unknown) => Array.isArray(value) && value.every((v) => typeof v === 'string')

// ---------- Fresh questions (no repeats) ----------
const SEEN_KEY = 'quiz-night:seen-questions'

// All questions from `pool` that are not in `excludeIds`, in random order,
// with questions the player has not seen yet first.
export function freshFirst(pool: Question[], excludeIds: string[] = []): Question[] {
  const seen = new Set(readStored<string[]>(SEEN_KEY, [], isStringList))
  const candidates = pool.filter((q) => !excludeIds.includes(q.id))
  return [...shuffle(candidates.filter((q) => !seen.has(q.id))), ...shuffle(candidates.filter((q) => seen.has(q.id)))]
}

// Remembers that questions were played. When every question in the pool has
// been seen, the pool starts over (only the ones just played stay "seen").
export function markSeen(pool: Question[], ids: string[]) {
  const seen = new Set(readStored<string[]>(SEEN_KEY, [], isStringList))
  for (const id of ids) seen.add(id)
  if (pool.every((q) => seen.has(q.id))) {
    for (const q of pool) if (!ids.includes(q.id)) seen.delete(q.id)
  }
  writeStored(SEEN_KEY, [...seen])
}

// A question ready to play: its answers in shuffled order.
export type Round = {
  question: Question
  options: string[]
  correctIndex: number
}

export function makeRound(question: Question): Round {
  const options = shuffle([question.correct, ...question.wrong])
  return { question, options, correctIndex: options.indexOf(question.correct) }
}

// ---------- Settings ----------
const SETTINGS_KEY = 'quiz-night:settings'

export type Settings = {
  names: [string, string]
  category: Category | 'all'
  difficulty: Difficulty | 'any'
  length: 5 | 10 | 15
  timer: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  names: ['', ''],
  category: 'all',
  difficulty: 'any',
  length: 5,
  timer: false,
}

const isSettings = (v: unknown) =>
  isObject(v) &&
  isStringList(v.names) &&
  (v.names as string[]).length === 2 &&
  (v.category === 'all' || (CATEGORIES as readonly unknown[]).includes(v.category)) &&
  (v.difficulty === 'any' || (DIFFICULTIES as readonly unknown[]).includes(v.difficulty)) &&
  [5, 10, 15].includes(v.length as number) &&
  typeof v.timer === 'boolean'

export function loadSettings(): Settings {
  return readStored<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS, isSettings)
}

export function saveSettings(settings: Settings) {
  writeStored(SETTINGS_KEY, settings)
}

// ---------- High scores ----------
const HIGH_SCORES_KEY = 'quiz-night:high-scores'
const MAX_HIGH_SCORES = 10

export type HighScore = {
  id: string
  name: string
  points: number
  correct: number
  total: number
  settings: string // for example "Solo, all topics, any difficulty, countdown"
  date: string // ISO date
}

const isHighScoreList = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (v) =>
      isObject(v) &&
      typeof v.id === 'string' &&
      typeof v.name === 'string' &&
      typeof v.points === 'number' &&
      typeof v.correct === 'number' &&
      typeof v.total === 'number' &&
      typeof v.settings === 'string' &&
      typeof v.date === 'string',
  )

export function loadHighScores(): HighScore[] {
  return readStored<HighScore[]>(HIGH_SCORES_KEY, [], isHighScoreList)
}

// Adds new scores, keeps the best ten, and returns the place (1–10) of
// each new score on the list, or null if it did not make the list.
export function addHighScores(entries: Omit<HighScore, 'id' | 'date'>[]): (number | null)[] {
  const date = new Date().toISOString()
  const added = entries.map((e, i) => ({ ...e, id: `${Date.now()}-${i}`, date }))
  const list = [...loadHighScores(), ...added]
    .sort((a, b) => b.points - a.points || b.correct - a.correct || a.date.localeCompare(b.date))
    .slice(0, MAX_HIGH_SCORES)
  writeStored(HIGH_SCORES_KEY, list)
  return added.map((e) => {
    const index = list.findIndex((h) => h.id === e.id)
    return index === -1 ? null : index + 1
  })
}

export function clearHighScores() {
  writeStored(HIGH_SCORES_KEY, [])
}

// ---------- Topic stats ----------
// For each player name: how many questions per topic were answered and how many were right.
const STATS_KEY = 'quiz-night:topic-stats'

export type TopicCount = { answered: number; correct: number }
export type TopicStats = Record<string, Partial<Record<Category, TopicCount>>>

const isStats = (v: unknown) =>
  isObject(v) &&
  Object.values(v).every(
    (perTopic) =>
      isObject(perTopic) &&
      Object.entries(perTopic).every(
        ([topic, count]) =>
          (CATEGORIES as readonly string[]).includes(topic) &&
          isObject(count) &&
          typeof count.answered === 'number' &&
          typeof count.correct === 'number',
      ),
  )

export function loadStats(): TopicStats {
  return readStored<TopicStats>(STATS_KEY, {}, isStats)
}

export function recordStats(results: { name: string; category: Category; correct: boolean }[]): TopicStats {
  const stats = loadStats()
  for (const r of results) {
    const perTopic = (stats[r.name] ??= {})
    const count = (perTopic[r.category] ??= { answered: 0, correct: 0 })
    count.answered += 1
    if (r.correct) count.correct += 1
  }
  writeStored(STATS_KEY, stats)
  return stats
}

export function clearStats() {
  writeStored(STATS_KEY, {})
}

// ---------- Custom questions from the question editor ----------
const CUSTOM_KEY = 'quiz-night:custom-questions'

const isQuestionList = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (v) =>
      isObject(v) &&
      typeof v.id === 'string' &&
      (CATEGORIES as readonly unknown[]).includes(v.category) &&
      (DIFFICULTIES as readonly unknown[]).includes(v.difficulty) &&
      typeof v.question === 'string' &&
      typeof v.correct === 'string' &&
      isStringList(v.wrong) &&
      (v.wrong as string[]).length === 3 &&
      typeof v.explanation === 'string',
  )

export function loadCustomQuestions(): Question[] {
  return readStored<Question[]>(CUSTOM_KEY, [], isQuestionList)
}

export function saveCustomQuestions(questions: Question[]) {
  writeStored(CUSTOM_KEY, questions)
}

// ---------- Demo questions chosen for the presentation ----------
const DEMO_KEY = 'quiz-night:demo-questions'

export function loadDemoIds(): string[] {
  return readStored<string[]>(DEMO_KEY, [], isStringList)
}

export function saveDemoIds(ids: string[]) {
  writeStored(DEMO_KEY, ids)
}

// ---------- Sound on/off ----------
const SOUND_KEY = 'quiz-night:sound'

export function loadSoundSetting(): boolean {
  return readStored<boolean>(SOUND_KEY, true, (v) => typeof v === 'boolean')
}

export function saveSoundSetting(on: boolean) {
  writeStored(SOUND_KEY, on)
}
