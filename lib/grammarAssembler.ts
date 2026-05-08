/**
 * GrammarAssembler - Assembles translated words into grammatically correct Russian sentences
 *
 * Takes tokens with translations and reassembles them with proper:
 * - Word order (Russian SVO, but flexible)
 * - Case agreement (adjectives match noun gender/number/case)
 * - Preposition + case combinations (в + prepositional, к + dative, etc.)
 */

import { getWordCache } from './wordCache';
import { resolveNumber } from './numberResolver';
import { applyAgreement } from './agreementEngine';

export interface TranslatedToken {
  original: string;
  translation: string;
  pos: string;
  gender?: 'm' | 'f' | 'n';
  number?: 'sg' | 'pl';
  case?: 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'prep';
}

/**
 * Assemble translated tokens into a grammatically correct sentence
 */
export function assembleSentence(tokens: TranslatedToken[]): string {
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0].translation;

  // Apply case agreement based on prepositions
  const adjusted = applyPrepositionCases(tokens);

  // Apply adjective-noun agreement
  const agreed = applyAdjectiveAgreement(adjusted);

  // Join with spaces
  return agreed.map(t => t.translation).join(' ');
}

/**
 * Apply case requirements from prepositions
 * Russian prepositions govern specific cases:
 * - в, на, о, при → prepositional case
 * - к, по → dative case
 * - с, у, от, до, из, без → genitive case
 * - через, про, за, под, над → accusative case
 */
function applyPrepositionCases(tokens: TranslatedToken[]): TranslatedToken[] {
  const result: TranslatedToken[] = [];
  const wordCache = getWordCache();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // If this is a preposition, mark the case for the next noun
    if (token.pos === 'preposition' && i + 1 < tokens.length) {
      const prep = token.original.toLowerCase();
      let requiredCase: 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'prep' | undefined;

      // Determine required case
      if (['в', 'на', 'о', 'об', 'при'].includes(prep) ||
          ['in', 'on', 'about', 'at'].includes(prep)) {
        requiredCase = 'prep';
      } else if (['к', 'по'].includes(prep) || ['to', 'toward', 'by'].includes(prep)) {
        requiredCase = 'dat';
      } else if (['с', 'у', 'от', 'до', 'из', 'без'].includes(prep) ||
                 ['from', 'of', 'without'].includes(prep)) {
        requiredCase = 'gen';
      } else if (['через', 'про', 'за', 'под', 'над'].includes(prep) ||
                 ['through', 'for', 'under', 'over'].includes(prep)) {
        requiredCase = 'acc';
      }

      result.push(token);

      // Apply case to following noun phrase (adjectives + noun)
      if (requiredCase) {
        let j = i + 1;
        while (j < tokens.length && (tokens[j].pos === 'adjective' || tokens[j].pos === 'noun')) {
          const nextToken = { ...tokens[j], case: requiredCase };

          // Try to get the correct case form from word cache
          const cached = wordCache.get(nextToken.original);
          if (cached && cached.forms[requiredCase]) {
            nextToken.translation = cached.forms[requiredCase];
          }

          result.push(nextToken);
          j++;
        }
        i = j - 1; // Skip processed tokens
      }
    } else {
      result.push(token);
    }
  }

  return result;
}

/**
 * Apply adjective-noun gender/number agreement
 * Russian adjectives must match the noun they modify
 */
function applyAdjectiveAgreement(tokens: TranslatedToken[]): TranslatedToken[] {
  const result: TranslatedToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // If this is an adjective followed by a noun, apply agreement
    if (token.pos === 'adjective' && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1];

      if (nextToken.pos === 'noun') {
        // Get noun's gender and number
        const gender = nextToken.gender || 'm';
        const number = nextToken.number || 'sg';

        // Apply agreement to adjective
        const agreed = applyAgreement(
          token.translation,
          'adjective',
          gender,
          number === 'pl',
          null
        );

        result.push({ ...token, translation: agreed, gender, number });
        continue;
      }
    }

    result.push(token);
  }

  return result;
}

/**
 * Translate a sentence by splitting into words, translating each, and reassembling
 */
export async function translateSentenceWordByWord(
  sentence: string,
  translateWord: (word: string) => Promise<string | null>
): Promise<string | null> {
  const wordCache = getWordCache();

  // Split into words (simple whitespace split for now)
  const words = sentence.split(/\s+/).filter(w => w.length > 0);

  const tokens: TranslatedToken[] = [];

  for (const word of words) {
    // Check if it's a number
    const numInfo = resolveNumber([word]);
    if (numInfo.count !== null) {
      tokens.push({
        original: word,
        translation: word, // Keep numbers as-is
        pos: 'number',
        number: numInfo.isPlural ? 'pl' : 'sg'
      });
      continue;
    }

    // Try to get from cache
    let cached = wordCache.get(word);

    if (!cached) {
      // Translate the word
      const translation = await translateWord(word);
      if (!translation) return null;

      // Store in cache (basic form)
      wordCache.set(word, {
        nom_sg: translation
      });

      cached = wordCache.get(word);
    }

    if (!cached) return null;

    // Use nominative singular as default
    tokens.push({
      original: word,
      translation: cached.forms.nom_sg || word,
      pos: cached.pos || 'noun',
      gender: cached.gender,
      number: 'sg'
    });
  }

  // Assemble with grammar rules
  return assembleSentence(tokens);
}

/**
 * Get statistics about grammar assembly
 */
export function getAssemblerStats() {
  return {
    version: '1.0.0',
    features: [
      'Preposition case agreement',
      'Adjective-noun gender agreement',
      'Number detection and agreement'
    ]
  };
}
