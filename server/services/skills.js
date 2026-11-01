const ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  reactjs: 'react',
  'react.js': 'react',
  node: 'node.js',
  nodejs: 'node.js',
  postgres: 'postgresql',
  mongo: 'mongodb',
  ml: 'machine learning',
  'ms excel': 'excel',
  'microsoft excel': 'excel',
  'power bi desktop': 'power bi',
  'microsoft power bi': 'power bi',
  'tableau desktop': 'tableau',
  'structured query language': 'sql',
  'data visualisation': 'data visualization',
  'a/b tests': 'a/b testing',
};

export const roleKey = (role = '') => role.trim().toLowerCase().replace(/\s+/g, ' ');

export function skillKey(name) {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[key] ?? key;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// A shortened quote such as "first ... then" passes when each part is in the text, in order.
export function quoteExists(quote, text) {
  const haystack = normalizeText(text);
  const parts = normalizeText(quote)
    .split(/\.{3}|…/)
    .map((part) => part.replace(/^["'\s]+|["'\s]+$/g, ''))
    .filter(Boolean);

  let position = 0;
  for (const part of parts) {
    const found = haystack.indexOf(part, position);
    if (found === -1) return false;
    position = found + part.length;
  }
  return parts.length > 0;
}

// Drops skills whose quote is not really in the job description, and merges duplicates.
export function verifyEvidence(extracted, jobText) {
  const byKey = new Map();
  let dropped = 0;

  for (const skill of extracted) {
    if (!quoteExists(skill.quote, jobText)) {
      dropped++;
      continue;
    }
    const key = skillKey(skill.name);
    if (!byKey.has(key)) byKey.set(key, { ...skill, key });
  }

  return { skills: [...byKey.values()], dropped };
}
