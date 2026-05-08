/**
 * Word-Based Translator - Universal translation system
 *
 * Splits sentences into words, translates each word individually,
 * stores translations, and reassembles with correct Russian grammar.
 *
 * Flow:
 * 1. Split sentence into tokens (SentenceSplitter)
 * 2. For each token:
 *    - Check WordCache
 *    - If not found, translate via DeepL
 *    - Store in WordCache
 * 3. Reassemble with grammar rules (GrammarAssembler)
 */

import { SentenceSplitter } from './sentenceSplitter';
import { getWordCache } from './wordCache';
import { translateTexts } from './deepl';
import { translateSentenceWordByWord, TranslatedToken, assembleSentence } from './grammarAssembler';
import { resolveNumber } from './numberResolver';

export interface WordBasedResult {
  text: string;
  source: 'word-based' | 'deepl-fallback';
  wordsUsed: number;
  wordsCached: number;
  wordsTranslated: number;
}

/**
 * Translate a sentence using word-based approach
 * @param sentence - The sentence to translate
 * @param targetLang - Target language (default: RU)
 * @returns Translation result with statistics
 */
export async function translateWordBased(
  sentence: string,
  targetLang: string = 'RU'
): Promise<WordBasedResult | null> {
  const splitter = new SentenceSplitter();
  const wordCache = getWordCache();

  // Split into words first (before tokenization to preserve numbers)
  const words = sentence.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return null;
  }

  // Statistics
  let wordsUsed = 0;
  let wordsCached = 0;
  let wordsTranslated = 0;

  const translatedTokens: TranslatedToken[] = [];

  for (const word of words) {
    wordsUsed++;

    // Check if it's a number
    const numInfo = resolveNumber([word]);
    if (numInfo.count !== null) {
      translatedTokens.push({
        original: word,
        translation: word, // Keep numbers as-is
        pos: 'number',
        number: numInfo.isPlural ? 'pl' : 'sg'
      });
      continue;
    }

    // Get token info for POS tagging
    const tokens = splitter.split(word);
    const token = tokens[0] || { word, lemma: word, pos: 'noun', index: 0, isContentWord: true };

    // Try to get from cache
    let cached = wordCache.get(word);

    if (cached) {
      // Found in cache
      wordsCached++;
      translatedTokens.push({
        original: word,
        translation: cached.forms.nom_sg || word,
        pos: cached.pos || token.pos,
        gender: cached.gender,
        number: numInfo.isPlural ? 'pl' : 'sg'
      });
    } else {
      // Need to translate
      try {
        const translation = (await translateTexts([word]))[0];
        wordsTranslated++;

        // Store in cache
        wordCache.set(word, {
          nom_sg: translation
        });

        translatedTokens.push({
          original: word,
          translation: translation,
          pos: token.pos,
          number: numInfo.isPlural ? 'pl' : 'sg'
        });
      } catch (error) {
        console.error(`[word-based] Failed to translate "${word}":`, error);
        // Fallback: use original word
        translatedTokens.push({
          original: word,
          translation: word,
          pos: token.pos
        });
      }
    }
  }

  // Assemble with grammar rules
  const assembled = assembleSentence(translatedTokens);

  return {
    text: assembled,
    source: 'word-based',
    wordsUsed,
    wordsCached,
    wordsTranslated
  };
}

/**
 * Try word-based translation, fallback to full sentence translation if needed
 * @param sentence - The sentence to translate
 * @param targetLang - Target language (default: RU)
 * @returns Translation result
 */
export async function translateWithWordBasedFallback(
  sentence: string,
  targetLang: string = 'RU'
): Promise<WordBasedResult> {
  try {
    // Try word-based approach
    const result = await translateWordBased(sentence, targetLang);

    if (result && result.text && result.text.length > 0) {
      return result;
    }
  } catch (error) {
    console.error('[word-based] Word-based translation failed, falling back to DeepL:', error);
  }

  // Fallback: translate entire sentence via DeepL
  try {
    const translation = (await translateTexts([sentence]))[0];

    // Learn from this translation
    const wordCache = getWordCache();
    wordCache.learnFromTranslation(sentence, translation);

    return {
      text: translation,
      source: 'deepl-fallback',
      wordsUsed: 0,
      wordsCached: 0,
      wordsTranslated: 1
    };
  } catch (error) {
    console.error('[word-based] DeepL fallback failed:', error);
    return {
      text: sentence, // Return original as last resort
      source: 'deepl-fallback',
      wordsUsed: 0,
      wordsCached: 0,
      wordsTranslated: 0
    };
  }
}

/**
 * Get statistics about word-based translation system
 */
export function getWordBasedStats() {
  const wordCache = getWordCache();
  const stats = wordCache.getStats();

  return {
    totalWords: stats.totalWords,
    byPos: stats.byPos,
    averageConfidence: stats.avgConfidence
  };
}
