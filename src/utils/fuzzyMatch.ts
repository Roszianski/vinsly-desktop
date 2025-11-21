/**
 * Calculate the Levenshtein distance between two strings
 * This measures how many single-character edits are needed to change one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Fuzzy match with typo tolerance
 * Returns true if the query matches the text within the tolerance threshold
 * @param text - The text to search in
 * @param query - The search query
 * @param tolerance - Maximum edit distance allowed (default: 2 for typo tolerance)
 */
export function fuzzyMatch(text: string, query: string, tolerance: number = 2): boolean {
  if (!query) return true;
  if (!text) return false;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact substring match
  if (lowerText.includes(lowerQuery)) {
    return true;
  }

  // Check if query matches any word in the text with tolerance
  const words = lowerText.split(/\s+/);

  for (const word of words) {
    // For short queries (1-2 chars), require exact match
    if (lowerQuery.length <= 2) {
      if (word.startsWith(lowerQuery)) {
        return true;
      }
    } else {
      // For longer queries, check if the word starts with query or has small edit distance
      if (word.startsWith(lowerQuery)) {
        return true;
      }

      // Calculate tolerance based on query length
      const maxDistance = Math.min(tolerance, Math.floor(lowerQuery.length / 3));

      // Check edit distance for words of similar length
      if (Math.abs(word.length - lowerQuery.length) <= maxDistance) {
        const distance = levenshteinDistance(word, lowerQuery);
        if (distance <= maxDistance) {
          return true;
        }
      }

      // Check if query fuzzy matches the beginning of the word
      if (word.length >= lowerQuery.length) {
        const prefix = word.substring(0, lowerQuery.length);
        const distance = levenshteinDistance(prefix, lowerQuery);
        if (distance <= maxDistance) {
          return true;
        }
      }
    }
  }

  return false;
}
