/**
 * Number Resolver - Determines count and plurality from tokens
 * Handles both explicit numbers and plural forms
 */

export interface NumberInfo {
  count: number | null;  // number if found, otherwise null
  isPlural: boolean;     // true if plural form detected
}

export class NumberResolver {
  /**
   * Resolve number information from tokens
   * Priority: 1) explicit number, 2) -s/-es ending, 3) article a/an
   */
  resolve(tokens: string[]): NumberInfo {
    // Step 1: Look for explicit number in tokens (highest priority)
    for (const token of tokens) {
      const num = parseInt(token, 10);
      if (!isNaN(num) && token === num.toString()) {
        // Found a number
        return {
          count: num,
          isPlural: num !== 1
        };
      }
    }

    // Step 2: Check for plural ending -s/-es on last noun-like token
    // Look at the last token that could be a noun
    const lastToken = tokens[tokens.length - 1];
    if (lastToken && this.hasPluralEnding(lastToken)) {
      return {
        count: null,
        isPlural: true
      };
    }

    // Step 3: Check for article "a" or "an" (indicates singular)
    const firstToken = tokens[0]?.toLowerCase();
    if (firstToken === 'a' || firstToken === 'an') {
      return {
        count: null,
        isPlural: false
      };
    }

    // Default: assume singular if no indicators found
    return {
      count: null,
      isPlural: false
    };
  }

  /**
   * Check if word has plural ending -s or -es
   */
  private hasPluralEnding(word: string): boolean {
    const lower = word.toLowerCase();

    // Common plural endings
    if (lower.endsWith('s')) {
      // Exclude words that naturally end in 's' (not plural)
      // e.g., "glass", "brass", "moss"
      const exceptions = ['glass', 'brass', 'moss', 'grass', 'class'];
      if (exceptions.includes(lower)) {
        return false;
      }
      return true;
    }

    return false;
  }
}

// Singleton instance
let instance: NumberResolver | null = null;

export function getNumberResolver(): NumberResolver {
  if (!instance) {
    instance = new NumberResolver();
  }
  return instance;
}

/**
 * Helper function: Resolve number information from a token or text
 * @param text - The text to analyze (could be a number or word)
 * @returns NumberInfo with count and plurality
 */
export function resolveNumber(text: string | string[]): NumberInfo {
  const resolver = getNumberResolver();
  // If text is a string, convert to array
  const tokens = Array.isArray(text) ? text : [text];
  return resolver.resolve(tokens);
}
