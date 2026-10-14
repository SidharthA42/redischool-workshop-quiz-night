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

Multiple-choice questions about LLMs, tokens, context windows and AI agents. The agent drafts ten questions in one data file. The app shows the first five in that order; the team fact-checks all ten and moves its best five to the top.

## Out of scope

- Timer
- Categories and difficulty levels
- Saving high scores
- More than one player
- Level-ups from README.md, until the team adds them to this brief

## Explicit overrides

None. Use the defaults in `AGENTS.md` unless the participant explicitly requests an override.

When an override is requested, replace "None" with the specific participant decision and its scope. Only record decisions actually requested or approved by the participant; the agent must not propose alternative stacks or excluded features proactively.

## Project decisions

None yet.
