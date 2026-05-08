/**
 * Sentence Splitter - Breaks sentences into tokens with part-of-speech tagging
 * This is a simplified version that uses pattern matching and heuristics
 * For production, consider using a proper NLP library like compromise or natural
 */

export interface Token {
  word: string;           // Original word
  lemma: string;          // Base form (lowercase, no punctuation)
  pos: string;            // Part of speech: noun, verb, adjective, preposition, etc.
  index: number;          // Position in sentence
  isContentWord: boolean; // True for nouns, verbs, adjectives (words worth translating)
}

export class SentenceSplitter {
  // Common English articles
  private articles = new Set(['a', 'an', 'the']);

  // Common English prepositions
  private prepositions = new Set([
    'in', 'on', 'at', 'to', 'from', 'with', 'by', 'for',
    'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'over', 'inside',
    'outside', 'within', 'without', 'upon', 'onto', 'toward'
  ]);

  // Common English conjunctions
  private conjunctions = new Set([
    'and', 'or', 'but', 'nor', 'yet', 'so', 'for'
  ]);

  // Common English pronouns
  private pronouns = new Set([
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'its', 'our', 'their',
    'myself', 'yourself', 'himself', 'herself', 'itself',
    'ourselves', 'yourselves', 'themselves',
    'this', 'that', 'these', 'those',
    'who', 'whom', 'whose', 'which', 'what'
  ]);

  // Common English auxiliary verbs
  private auxiliaries = new Set([
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'shall', 'should', 'can', 'could',
    'may', 'might', 'must'
  ]);

  /**
   * Split sentence into tokens with POS tagging
   */
  split(sentence: string): Token[] {
    // Split by whitespace and punctuation
    const words = sentence.split(/\s+/);
    const tokens: Token[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Remove punctuation for lemma
      const lemma = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

      if (lemma.length === 0) continue; // Skip pure punctuation

      // Skip pure numbers
      if (/^\d+$/.test(lemma)) continue;

      // Determine part of speech
      const pos = this.detectPOS(lemma, i, words);

      // Content words are nouns, verbs, adjectives, adverbs
      const isContentWord = ['noun', 'verb', 'adjective', 'adverb'].includes(pos);

      tokens.push({
        word,
        lemma,
        pos,
        index: i,
        isContentWord
      });
    }

    return tokens;
  }

  /**
   * Detect part of speech using heuristics
   */
  private detectPOS(lemma: string, index: number, words: string[]): string {
    // Check against known word lists
    if (this.articles.has(lemma)) return 'article';
    if (this.prepositions.has(lemma)) return 'preposition';
    if (this.conjunctions.has(lemma)) return 'conjunction';
    if (this.pronouns.has(lemma)) return 'pronoun';
    if (this.auxiliaries.has(lemma)) return 'auxiliary';

    // Check for common nouns first (before verb/adjective checks)
    if (this.isCommonNoun(lemma)) return 'noun';

    // Check for verb patterns
    if (this.isVerb(lemma)) return 'verb';

    // Check for adjective patterns
    if (this.isAdjective(lemma)) return 'adjective';

    // Check for adverb patterns
    if (this.isAdverb(lemma)) return 'adverb';

    // Default to noun (most common content word)
    return 'noun';
  }

  /**
   * Check if word is a common noun
   */
  private isCommonNoun(word: string): boolean {
    const commonNouns = new Set([
      'hero', 'warrior', 'knight', 'mage', 'archer',
      'sword', 'axe', 'bow', 'shield', 'armor',
      'mine', 'cave', 'dungeon', 'castle', 'tower',
      'portal', 'gate', 'door', 'chest', 'treasure',
      'ingot', 'ingots', 'ore', 'gem', 'crystal',
      'iron', 'gold', 'diamond', 'copper', 'silver',
      'item', 'items', 'quest', 'mission', 'task',
      'world', 'realm', 'land', 'place', 'area'
    ]);

    return commonNouns.has(word);
  }

  /**
   * Check if word is likely a verb
   */
  private isVerb(word: string): boolean {
    // Common verb endings
    const verbEndings = ['ed', 'ing', 'ize', 'ise', 'ate', 'ify', 'en'];

    for (const ending of verbEndings) {
      if (word.endsWith(ending) && word.length > ending.length + 2) {
        return true;
      }
    }

    // Common irregular verbs
    const commonVerbs = new Set([
      'go', 'come', 'get', 'make', 'take', 'give', 'find',
      'think', 'tell', 'become', 'leave', 'feel', 'bring',
      'begin', 'keep', 'hold', 'write', 'stand', 'hear',
      'let', 'mean', 'set', 'meet', 'run', 'pay', 'sit',
      'speak', 'lie', 'lead', 'read', 'grow', 'lose', 'fall',
      'send', 'build', 'understand', 'draw', 'break', 'spend',
      'cut', 'rise', 'drive', 'buy', 'wear', 'choose', 'seek',
      'throw', 'catch', 'deal', 'win', 'forget', 'hang', 'strike',
      'discovered', 'discover', 'found', 'collected', 'collect'
    ]);

    return commonVerbs.has(word);
  }

  /**
   * Check if word is likely an adjective
   */
  private isAdjective(word: string): boolean {
    // Common adjective endings
    const adjEndings = ['ful', 'less', 'ous', 'ive', 'able', 'ible', 'al', 'ic', 'ical', 'ant', 'ent'];

    for (const ending of adjEndings) {
      if (word.endsWith(ending) && word.length > ending.length + 2) {
        return true;
      }
    }

    // Common adjectives
    const commonAdj = new Set([
      'good', 'new', 'first', 'last', 'long', 'great', 'little',
      'own', 'other', 'old', 'right', 'big', 'high', 'different',
      'small', 'large', 'next', 'early', 'young', 'important',
      'few', 'public', 'bad', 'same', 'able', 'ancient', 'dark',
      'deep', 'rare', 'powerful', 'magical', 'mysterious', 'hidden'
    ]);

    return commonAdj.has(word);
  }

  /**
   * Check if word is likely an adverb
   */
  private isAdverb(word: string): boolean {
    // Most adverbs end in -ly
    if (word.endsWith('ly') && word.length > 4) {
      return true;
    }

    // Common adverbs without -ly
    const commonAdv = new Set([
      'very', 'too', 'quite', 'rather', 'almost', 'always',
      'never', 'often', 'sometimes', 'usually', 'here', 'there',
      'now', 'then', 'today', 'tomorrow', 'yesterday', 'soon',
      'still', 'yet', 'already', 'just', 'only', 'also', 'even'
    ]);

    return commonAdv.has(word);
  }

  /**
   * Extract only content words (nouns, verbs, adjectives)
   */
  getContentWords(tokens: Token[]): Token[] {
    return tokens.filter(t => t.isContentWord);
  }

  /**
   * Get words by part of speech
   */
  getByPOS(tokens: Token[], pos: string): Token[] {
    return tokens.filter(t => t.pos === pos);
  }

  /**
   * Simple sentence structure analysis
   */
  analyzeStructure(tokens: Token[]): {
    hasSubject: boolean;
    hasVerb: boolean;
    hasObject: boolean;
    complexity: 'simple' | 'compound' | 'complex';
  } {
    const verbs = tokens.filter(t => t.pos === 'verb');
    const nouns = tokens.filter(t => t.pos === 'noun');
    const conjunctions = tokens.filter(t => t.pos === 'conjunction');

    // Complex if has multiple clauses or many content words
    const contentWords = tokens.filter(t => t.isContentWord);

    return {
      hasSubject: nouns.length > 0,
      hasVerb: verbs.length > 0,
      hasObject: nouns.length > 1,
      complexity: conjunctions.length > 0 ? 'compound' :
                  contentWords.length >= 6 ? 'complex' : 'simple'
    };
  }
}

// Singleton instance
let instance: SentenceSplitter | null = null;

export function getSentenceSplitter(): SentenceSplitter {
  if (!instance) {
    instance = new SentenceSplitter();
  }
  return instance;
}
