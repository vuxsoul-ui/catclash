const CAT_NAME_BLOCKLIST = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'pussy',
  'nigger',
  'faggot',
  'cunt',
  'whore',
  'slut',
  'rape',
  'naz',
];

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '(': 'c',
  '<': 'c',
  '3': 'e',
  '6': 'g',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '9': 'g',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't',
  '2': 'z',
};

function normalizeLeet(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] || ch)
    .join('');
}

export function sanitizeCatName(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function containsBlockedCatNameContent(raw: string): boolean {
  const cleaned = sanitizeCatName(raw).toLowerCase();
  const compact = cleaned.replace(/[^a-z0-9]/g, '');
  const leet = normalizeLeet(cleaned).replace(/[^a-z0-9]/g, '');

  return CAT_NAME_BLOCKLIST.some((word) => {
    return cleaned.includes(word) || compact.includes(word) || leet.includes(word);
  });
}

export function validateCatName(raw: string): { ok: boolean; value?: string; error?: string } {
  const value = sanitizeCatName(raw);
  if (value.length < 1 || value.length > 30) {
    return { ok: false, error: 'Cat name must be 1-30 characters' };
  }

  if (!/[a-zA-Z0-9]/.test(value)) {
    return { ok: false, error: 'Cat name must include letters or numbers' };
  }

  if (containsBlockedCatNameContent(value)) {
    return { ok: false, error: 'Cat name rejected by content filter' };
  }

  return { ok: true, value };
}

export function sanitizeCatDescription(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function containsBlockedDescriptionContent(raw: string): boolean {
  const cleaned = sanitizeCatDescription(raw).toLowerCase();
  const compact = cleaned.replace(/[^a-z0-9]/g, '');
  const leet = normalizeLeet(cleaned).replace(/[^a-z0-9]/g, '');

  return CAT_NAME_BLOCKLIST.some((word) => cleaned.includes(word) || compact.includes(word) || leet.includes(word));
}

export function validateCatDescription(raw: string): { ok: boolean; value?: string; error?: string } {
  const value = sanitizeCatDescription(raw);
  if (!value) return { ok: true, value: '' };
  if (value.length > 200) return { ok: false, error: 'Description must be 200 characters or fewer' };
  if (containsBlockedDescriptionContent(value)) {
    return { ok: false, error: 'Description rejected by content filter' };
  }
  return { ok: true, value };
}
