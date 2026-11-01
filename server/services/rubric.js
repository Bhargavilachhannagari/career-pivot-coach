import { quoteExists } from './skills.js';

const MAX_SCORE_WITHOUT_QUOTE = 2;

export const RUBRIC = [
  {
    key: 'relevance',
    label: 'Relevance',
    levels: {
      1: 'Does not address the question.',
      2: 'Touches the topic but misses the main point.',
      3: 'Answers the question at a general level.',
      4: 'Answers the question directly and stays on topic.',
      5: 'Answers precisely and connects it to what the role needs.',
    },
  },
  {
    key: 'depth',
    label: 'Depth',
    levels: {
      1: 'No real knowledge shown.',
      2: 'Only surface-level or vague statements.',
      3: 'Correct basics with little detail.',
      4: 'Correct, detailed, and aware of trade-offs.',
      5: 'Expert detail, including edge cases and alternatives.',
    },
  },
  {
    key: 'structure',
    label: 'Structure',
    levels: {
      1: 'No clear order.',
      2: 'Hard to follow, with jumps between ideas.',
      3: 'Some order, but it wanders.',
      4: 'Clear beginning, middle and end.',
      5: 'Tightly organized, with a clear conclusion.',
    },
  },
  {
    key: 'evidence',
    label: 'Evidence',
    levels: {
      1: 'No examples.',
      2: 'A hypothetical or vague example.',
      3: 'One real example with little detail.',
      4: 'A specific example with the actions taken.',
      5: 'A specific example with measurable results.',
    },
  },
  {
    key: 'communication',
    label: 'Communication',
    levels: {
      1: 'Very hard to understand.',
      2: 'Understandable, but unclear in places.',
      3: 'Clear, with some filler or jargon.',
      4: 'Clear and concise.',
      5: 'Clear, concise, and suited to the audience.',
    },
  },
];

export const rubricText = () =>
  RUBRIC.map(
    ({ key, levels }) =>
      `${key}: ${Object.entries(levels)
        .map(([score, text]) => `${score} = ${text}`)
        .join(' ')}`,
  ).join('\n');

// Every score needs a real quote from the answer, otherwise it is capped.
export function applyRubric(rawScores, answer) {
  const scores = RUBRIC.map(({ key, label }) => {
    const raw = rawScores.find((item) => item.criterion === key);
    if (!raw) {
      return { criterion: key, label, score: 1, quote: '', verified: false, feedback: 'This area was not scored.' };
    }
    const verified = quoteExists(raw.quote, answer);
    return {
      criterion: key,
      label,
      score: verified ? raw.score : Math.min(raw.score, MAX_SCORE_WITHOUT_QUOTE),
      quote: verified ? raw.quote : '',
      verified,
      feedback: raw.feedback,
    };
  });

  const total = scores.reduce((sum, item) => sum + item.score, 0);
  return { scores, overall: Math.round((total / scores.length) * 10) / 10 };
}
