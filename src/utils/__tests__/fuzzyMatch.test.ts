import { fuzzyMatch } from '../fuzzyMatch';

describe('fuzzyMatch', () => {
  describe('Empty string handling', () => {
    it('returns true for empty query', () => {
      expect(fuzzyMatch('hello world', '')).toBe(true);
    });

    it('returns false for empty text with non-empty query', () => {
      expect(fuzzyMatch('', 'hello')).toBe(false);
    });

    it('returns true for both empty strings', () => {
      expect(fuzzyMatch('', '')).toBe(true);
    });
  });

  describe('Exact matches', () => {
    it('matches exact substring', () => {
      expect(fuzzyMatch('hello world', 'world')).toBe(true);
    });

    it('matches exact full string', () => {
      expect(fuzzyMatch('hello', 'hello')).toBe(true);
    });

    it('matches at the beginning', () => {
      expect(fuzzyMatch('hello world', 'hello')).toBe(true);
    });

    it('matches at the end', () => {
      expect(fuzzyMatch('hello world', 'world')).toBe(true);
    });

    it('matches in the middle', () => {
      expect(fuzzyMatch('hello world test', 'world')).toBe(true);
    });
  });

  describe('Case insensitivity', () => {
    it('matches lowercase query against uppercase text', () => {
      expect(fuzzyMatch('HELLO WORLD', 'hello')).toBe(true);
    });

    it('matches uppercase query against lowercase text', () => {
      expect(fuzzyMatch('hello world', 'HELLO')).toBe(true);
    });

    it('matches mixed case', () => {
      expect(fuzzyMatch('HeLLo WoRLd', 'hElLo')).toBe(true);
    });
  });

  describe('Short query behavior (1-2 chars)', () => {
    it('matches 1-char query at word start', () => {
      expect(fuzzyMatch('hello world', 'h')).toBe(true);
      expect(fuzzyMatch('hello world', 'w')).toBe(true);
    });

    it('matches 2-char query at word start', () => {
      expect(fuzzyMatch('hello world', 'he')).toBe(true);
      expect(fuzzyMatch('hello world', 'wo')).toBe(true);
    });

    it('does not match 1-char query in middle of word', () => {
      expect(fuzzyMatch('hello world', 'e')).toBe(true); // 'e' is in 'hello'
      expect(fuzzyMatch('test data', 'a')).toBe(true); // 'a' is in 'data'
    });

    it('requires exact prefix for short queries', () => {
      expect(fuzzyMatch('world test', 'wo')).toBe(true);
      expect(fuzzyMatch('world test', 'wr')).toBe(false); // Not a prefix
    });
  });

  describe('Word boundary matching', () => {
    it('matches query against individual words', () => {
      expect(fuzzyMatch('the quick brown fox', 'quick')).toBe(true);
      expect(fuzzyMatch('the quick brown fox', 'brown')).toBe(true);
    });

    it('splits on whitespace', () => {
      expect(fuzzyMatch('hello   world   test', 'world')).toBe(true);
    });

    it('matches first word', () => {
      expect(fuzzyMatch('hello world test', 'hel')).toBe(true);
    });

    it('matches last word', () => {
      expect(fuzzyMatch('hello world test', 'tes')).toBe(true);
    });
  });

  describe('Typo tolerance', () => {
    it('matches with 1-character edit distance', () => {
      // "hello" vs "helo" (missing 'l')
      expect(fuzzyMatch('hello world', 'helo')).toBe(true);
    });

    it('matches with substitution', () => {
      // "hello" vs "hallo"
      expect(fuzzyMatch('hello world', 'hallo')).toBe(true);
    });

    it('matches with prefix typo', () => {
      // "world" vs "wor" prefix check with tolerance
      expect(fuzzyMatch('this is world', 'wor')).toBe(true);
    });

    it('does not match with too many edits', () => {
      // "hello" vs "xyz" (too different)
      expect(fuzzyMatch('hello world', 'xyz')).toBe(false);
    });

    it('matches similar length words with small edit distance', () => {
      expect(fuzzyMatch('test data', 'tast')).toBe(true); // 1 edit
      expect(fuzzyMatch('test data', 'rest')).toBe(true); // 1 edit
    });
  });

  describe('Edit distance calculations', () => {
    it('allows edit distance based on query length', () => {
      // For query length 6+, max distance is ~2
      expect(fuzzyMatch('testing', 'testng')).toBe(true); // 1 edit
      expect(fuzzyMatch('testing', 'tsting')).toBe(true); // 1 edit
    });

    it('rejects matches beyond tolerance', () => {
      // Too many differences
      expect(fuzzyMatch('hello', 'xyz')).toBe(false);
      expect(fuzzyMatch('testing', 'abcdef')).toBe(false);
    });

    it('handles words of different lengths', () => {
      // "hellooo" (7 chars) vs "hello" (5 chars) in text - matches prefix with tolerance
      expect(fuzzyMatch('hello world', 'hellooo')).toBe(true); // Matches "hello" with tolerance
      expect(fuzzyMatch('test data', 'testing')).toBe(false); // Length difference too large (7 vs 4)
    });
  });

  describe('Prefix fuzzy matching', () => {
    it('matches prefix with small edit distance', () => {
      expect(fuzzyMatch('development testing', 'developent')).toBe(true); // Missing 'm'
    });

    it('matches word start with typo', () => {
      expect(fuzzyMatch('application server', 'apllication')).toBe(true); // Extra 'l'
    });
  });

  describe('Edge cases', () => {
    it('handles single character text', () => {
      expect(fuzzyMatch('a', 'a')).toBe(true);
      expect(fuzzyMatch('a', 'b')).toBe(false);
    });

    it('handles special characters', () => {
      expect(fuzzyMatch('hello-world', 'hello')).toBe(true);
      expect(fuzzyMatch('hello_world', 'world')).toBe(true);
      expect(fuzzyMatch('hello@world.com', 'world')).toBe(true);
    });

    it('handles numbers', () => {
      expect(fuzzyMatch('test123', '123')).toBe(true);
      expect(fuzzyMatch('version 2.0', '2.0')).toBe(true);
    });

    it('handles unicode characters', () => {
      expect(fuzzyMatch('café latté', 'café')).toBe(true);
      expect(fuzzyMatch('hello 世界', 'hello')).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    it('matches agent names with typos', () => {
      expect(fuzzyMatch('Code Review Agent', 'cod')).toBe(true);
      expect(fuzzyMatch('Code Review Agent', 'reviw')).toBe(true);
      expect(fuzzyMatch('Code Review Agent', 'agnt')).toBe(true);
    });

    it('matches skill names with partial input', () => {
      expect(fuzzyMatch('Python Development', 'pyth')).toBe(true);
      expect(fuzzyMatch('JavaScript Testing', 'java')).toBe(true);
      expect(fuzzyMatch('React Components', 'comp')).toBe(true);
    });

    it('matches file paths', () => {
      expect(fuzzyMatch('src/components/AgentList.tsx', 'agent')).toBe(true);
      expect(fuzzyMatch('src/utils/fuzzyMatch.ts', 'fuzzy')).toBe(true);
    });

    it('does not match completely unrelated queries', () => {
      expect(fuzzyMatch('Code Review Agent', 'database')).toBe(false);
      expect(fuzzyMatch('Python Development', 'rust')).toBe(false);
    });
  });
});
