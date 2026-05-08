/**
 * Agreement Engine - Handles morphological agreement
 * Declines nouns and agrees adjectives with proper gender and number
 */

import { WordEntry } from './wordLibrary';

export class AgreementEngine {
  /**
   * Agree adjective with noun based on plurality and count
   * Returns the correct form of adjective
   */
  agreeAdjective(adj: WordEntry, noun: WordEntry, isPlural: boolean, count?: number | null): string {
    if (adj.pos !== 'adjective') {
      throw new Error(`Expected adjective, got ${adj.pos}`);
    }

    // For numbers 2-4, use genitive plural form (like 5+)
    if (count !== null && count !== undefined && count >= 2 && count <= 4) {
      const form = adj.forms['adj_gen_pl'];
      if (form) {
        return form;
      }
      // Fallback to regular plural if gen_pl not available
    }

    // For numbers ≥5, use genitive plural form
    if (count !== null && count !== undefined && count >= 5) {
      const form = adj.forms['adj_gen_pl'];
      if (form) {
        return form;
      }
      // Fallback to regular plural if gen_pl not available
    }

    if (isPlural) {
      // Plural form
      const form = adj.forms['adj_pl'];
      if (!form) {
        throw new Error(`Adjective "${adj.forms.adj_m_sg || 'unknown'}" missing plural form (adj_pl)`);
      }
      return form;
    } else {
      // Singular form - need gender from noun
      if (noun.pos !== 'noun') {
        throw new Error(`Expected noun for gender agreement, got ${noun.pos}`);
      }

      const gender = noun.gender;
      if (!gender) {
        throw new Error(`Noun missing gender information`);
      }

      const formKey = `adj_${gender}_sg`;
      const form = adj.forms[formKey];
      if (!form) {
        throw new Error(`Adjective "${adj.forms.adj_m_sg || 'unknown'}" missing form ${formKey}`);
      }
      return form;
    }
  }

  /**
   * Decline noun based on count and plurality
   * Returns the correct case form of noun
   */
  declineNoun(noun: WordEntry, count: number | null, isPlural: boolean): string {
    if (noun.pos !== 'noun') {
      throw new Error(`Expected noun, got ${noun.pos}`);
    }

    let formKey: string;

    if (count === 1) {
      // count === 1 → nom_sg ("1 слиток")
      formKey = 'nom_sg';
    } else if (count !== null && count >= 2 && count <= 4) {
      // count >= 2, <= 4 → gen_sg ("2 слитка")
      formKey = 'gen_sg';
    } else if (count !== null && count >= 5) {
      // count >= 5 → gen_pl ("5 слитков")
      formKey = 'gen_pl';
    } else if (count === null && isPlural) {
      // count === null, мн.ч → nom_pl ("слитки")
      formKey = 'nom_pl';
    } else {
      // count === null, ед.ч → nom_sg ("слиток")
      formKey = 'nom_sg';
    }

    const form = noun.forms[formKey];
    if (!form) {
      throw new Error(`Noun missing form ${formKey}`);
    }

    return form;
  }
}

// Singleton instance
let instance: AgreementEngine | null = null;

export function getAgreementEngine(): AgreementEngine {
  if (!instance) {
    instance = new AgreementEngine();
  }
  return instance;
}

/**
 * Helper function: Apply agreement to a word (adjective or noun)
 * @param word - The word to decline/agree
 * @param pos - Part of speech ('adjective' or 'noun')
 * @param gender - Gender of the noun ('m', 'f', 'n')
 * @param isPlural - Whether the word is plural
 * @param count - Optional number for special 2-4 rule
 * @returns The correctly declined/agreed form
 */
export function applyAgreement(
  word: string,
  pos: 'adjective' | 'noun',
  gender: 'm' | 'f' | 'n',
  isPlural: boolean,
  count: number | null
): string {
  // For now, return the word as-is
  // This is a simplified version that doesn't require WordEntry
  // In full implementation, this would look up the word and apply proper forms
  return word;
}
