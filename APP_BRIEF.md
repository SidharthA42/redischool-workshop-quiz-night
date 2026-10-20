# App brief

This brief describes the first version of the app. Change it when your team decides something new; the agent follows it. Unfilled points are not requirements; the agent should ask about missing details needed for implementation.

## App name

Quiz Night

## User and problem

- Who will use it? Workshop participants who want to test what they learned about LLMs and AI agents.
- What problem does it solve? New concepts are easier to remember when you use them in a playful way.

## Main user journey

The player starts the quiz, answers five multiple-choice questions one at a time, sees immediately whether each answer was right, and finishes on a result screen with the score.

## Must-have features

1. Five questions with four answer options each.
2. Immediate feedback after each answer, with a visible running score.
3. A result screen with the final score and a "Play again" button.

## Demo acceptance criteria

- Given the start screen, when the player clicks Start, then question 1 of 5 appears with four answer options.
- Given a question, when the player picks the right answer, then it is marked as correct and the running score goes up by one.
- Given the last answer, then the result screen shows the score, for example "4 of 5", and "Play again" starts over with a score of 0.

## Sample data

Multiple-choice questions about LLMs, tokens, context windows and AI agents, all in one data file (`src/questions.ts`). The pool has 40 questions: 10 per topic, each marked easy, medium or hard, each with a short explanation. Every game picks five random questions. The team fact-checks the questions against the knowledge-session slides and fixes wrong ones by prompt.

## Out of scope

- Online features: accounts, shared leaderboards, a server or database (everything stays in the browser)
- More than two players

## Explicit overrides

None. Use the defaults in `AGENTS.md` unless the participant explicitly requests an override.

When an override is requested, replace "None" with the specific participant decision and its scope. Only record decisions actually requested or approved by the participant; the agent must not propose alternative stacks or excluded features proactively.

## Project decisions

- 2026-10-16: Random questions. The app draws five random questions from a pool of 40 for each game, avoids questions the player has already seen until the pool runs out (remembered in browser storage), and shuffles the answer order.
- 2026-10-16: A more polished, game-show style user interface.
- 2026-10-16: All README level-ups are in scope:
  - Countdown per question (on/off, 20 seconds) with a bonus point for a correct answer in the first 10 seconds. Running out of time counts as wrong.
  - Two players taking turns on one laptop, each with their own five questions; the result screen names the winner.
  - Categories (the four topics) and difficulty levels (easy, medium, hard), chosen before the game.
  - An explanation after each answer.
  - Animations, sounds (with a mute button) and confetti for a perfect score or a win.
  - A high-score list and a question editor, both saved in browser storage. Custom questions join the random pool.
- 2026-10-16: Small extras: answer review on the result screen and keyboard controls (A–D or 1–4 to answer).
- 2026-10-16: Players can type their names (also in 1-player mode, for the high-score list). If a topic and difficulty filter leaves fewer than five questions per player, the game gets shorter and the setup screen says so.

### Version 2 (decided 2026-10-16)

- Design: "Study Cards". Calm, focused look: soft grey-blue background, deep ink text, one sunflower-yellow accent, Space Grotesk headings and Source Sans 3 text. Each question is a card; the explanation is on its back.
- Home screen with mode cards: Solo, Duel, Challenge, Study cards, Demo. Each game mode has its own setup screen (names, topic, difficulty, game length, countdown). Settings are remembered in the browser.
- Every game screen has a clearly visible Quit button that goes back to the home screen.
- Explanation button: a right answer shows "Correct!" and Next. Any answer can open "Explain the answer", which flips the card to the explanation; after a wrong answer this button is the main action.
- Challenge mode (2 players): before each turn, the other player sees 3 random questions from the chosen topic (question and difficulty only, no answers) and picks one. Answerer gets +1 for a right answer; the picker gets +1 if the answerer gets it wrong. Skip is not available in Challenge.
- Duel mode (2 players): random questions, players take turns. Steal: after a wrong answer, the other player may answer from the remaining options for +1.
- Lifelines: one 50:50, one Skip and one +10 s (countdown only) per player per game.
- Streak bonus: every third right answer in a row gives +1.
- Game length: 5, 10 or 15 questions per player.
- Study mode: flip through all questions with answers and explanations, no score.
- Retry my mistakes (Solo): a round with only the questions you got wrong. It does not count for high scores.
- Topic stats per player name, saved in the browser: right answers per topic, strongest and weakest topic.
- Demo mode for the presentation: choose questions in advance (selection is remembered), show them with extra-large text, reveal the answer when the audience has guessed.
- Not done: an extra note for every wrong option (about 120 more statements to fact-check). Can be added later.
