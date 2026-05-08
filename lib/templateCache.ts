/**
 * Template Cache - SIMPLIFIED VERSION
 * Only handles specific patterns like "Collect N material item from the mine"
 */

import { WordLibrary, getWordLibrary } from './wordLibrary';
import { NumberResolver, getNumberResolver } from './numberResolver';
import { AgreementEngine, getAgreementEngine } from './agreementEngine';

export interface Template {
  patternEN: string;
  patternRU: string;
  slots: Record<string, string>;
}

export class TemplateCache {
  private templates: Map<string, Template> = new Map();
  private wordLibrary: WordLibrary;
  private numberResolver: NumberResolver;
  private agreementEngine: AgreementEngine;

  constructor() {
    this.wordLibrary = getWordLibrary();
    this.numberResolver = getNumberResolver();
    this.agreementEngine = getAgreementEngine();
  }

  /**
   * Learn a template - simplified to handle "Collect N material item from the mine" pattern
   */
  learn(original: string, translated: string): void {
    try {
      // Simple pattern: "Collect 10 iron ingots from the mine"
      const match = original.match(/^(\w+)\s+(\d+)\s+(\w+)\s+(\w+)\s+(.+)$/i);
      if (!match) return;

      const [, verb, number, adj, noun, rest] = match;

      // Check if words are in library
      const verbEntry = this.wordLibrary.getWord(verb);
      const adjEntry = this.wordLibrary.getWord(adj);
      const nounEntry = this.wordLibrary.getWord(noun);

      if (!verbEntry || !adjEntry || !nounEntry) return;

      // Create template key (structure without variable parts)
      const key = `${verb.toLowerCase()}_N_ADJ_NOUN_${rest.toLowerCase()}`;

      // Store template
      this.templates.set(key, {
        patternEN: `${verb} {N} {ADJ} {NOUN} ${rest}`,
        patternRU: translated,
        slots: {
          verb: verb.toLowerCase(),
          adj: adj.toLowerCase(),
          noun: noun.toLowerCase()
        }
      });

      console.log('[template-cache] Learned:', key);

    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Try to translate using templates
   */
  tryTranslate(text: string): string | null {
    try {
      // Try to match pattern
      const match = text.match(/^(\w+)\s+(\d+)\s+(\w+)\s+(\w+)\s+(.+)$/i);
      if (!match) return null;

      const [, verb, number, adj, noun, rest] = match;

      // Build template key
      const key = `${verb.toLowerCase()}_N_ADJ_NOUN_${rest.toLowerCase()}`;

      // Find matching template
      const template = this.templates.get(key);
      if (!template) return null;

      // Get word entries
      const adjEntry = this.wordLibrary.getWord(adj);
      const nounEntry = this.wordLibrary.getWord(noun);
      const verbEntry = this.wordLibrary.getWord(verb);

      if (!adjEntry || !nounEntry || !verbEntry) return null;

      // Resolve number
      const tokens = text.split(/\s+/);
      const numberInfo = this.numberResolver.resolve(tokens);

      // Decline noun
      const declinedNoun = this.agreementEngine.declineNoun(nounEntry, numberInfo.count, numberInfo.isPlural);

      // Agree adjective
      const agreedAdj = this.agreementEngine.agreeAdjective(adjEntry, nounEntry, numberInfo.isPlural, numberInfo.count);

      // Get verb form
      const verbForm = verbEntry.forms.imperative_pl || Object.values(verbEntry.forms)[0];

      // Build result by replacing in Russian template
      // Pattern: "Соберите 10 железных слитков из шахты"
      // Need to replace: verb form, number, adjective form, noun form

      // Get original word entries to find their forms in template
      const originalVerbEntry = this.wordLibrary.getWord(template.slots.verb);
      const originalAdjEntry = this.wordLibrary.getWord(template.slots.adj);
      const originalNounEntry = this.wordLibrary.getWord(template.slots.noun);

      if (!originalVerbEntry || !originalAdjEntry || !originalNounEntry) return null;

      // Replace in template
      let result = template.patternRU;

      // Replace number
      result = result.replace(/\d+/, number);

      // Replace verb forms
      for (const form of Object.values(originalVerbEntry.forms)) {
        if (result.includes(form)) {
          result = result.replace(form, verbForm);
          break;
        }
      }

      // Replace adjective forms
      for (const form of Object.values(originalAdjEntry.forms)) {
        if (result.includes(form)) {
          result = result.replace(form, agreedAdj);
          break;
        }
      }

      // Replace noun forms
      for (const form of Object.values(originalNounEntry.forms)) {
        if (result.includes(form)) {
          result = result.replace(form, declinedNoun);
          break;
        }
      }

      console.log(`[template-cache] Translated: "${text}" → "${result}"`);
      return result;

    } catch (error) {
      console.log('[template-cache] Error:', error);
      return null;
    }
  }

  /**
   * Get statistics
   */
  getStats(): { total: number } {
    return { total: this.templates.size };
  }
}

// Singleton
let instance: TemplateCache | null = null;

export function getTemplateCache(): TemplateCache {
  if (!instance) {
    instance = new TemplateCache();
  }
  return instance;
}
