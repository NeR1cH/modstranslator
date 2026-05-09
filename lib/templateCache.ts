/**
 * Template Cache - Hybrid approach
 * 1. Smart mode: "Collect N material item from the mine" with substitution
 * 2. Simple mode: "Copycat Block" with exact matching
 */

import { WordLibrary, getWordLibrary } from './wordLibrary';
import { NumberResolver, getNumberResolver } from './numberResolver';
import { AgreementEngine, getAgreementEngine } from './agreementEngine';

export interface Template {
  patternEN: string;
  patternRU: string;
  slots: Record<string, any>;
  mode: 'smart' | 'simple';
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
   * Learn a template - tries smart mode first, falls back to simple
   */
  learn(original: string, translated: string): void {
    try {
      // Try to learn as smart template (with pattern extraction)
      const smartTemplate = this.tryLearnSmart(original, translated);
      if (smartTemplate) {
        this.templates.set(smartTemplate.key, smartTemplate.template);
        console.log('[template-cache] Learned (smart):', smartTemplate.key);
        return;
      }

      // Fall back to simple exact matching
      const words = original.trim().split(/\s+/);
      if (words.length < 2) return;

      const key = words.map(w => w.toLowerCase()).join('_');
      this.templates.set(key, {
        patternEN: original,
        patternRU: translated,
        slots: {},
        mode: 'simple'
      });

      console.log('[template-cache] Learned (simple):', key);

    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Try to learn as smart template with pattern extraction
   * Pattern: "Verb Number Material Item Rest"
   * Example: "Collect 10 iron ingots from the mine"
   */
  private tryLearnSmart(original: string, translated: string): { key: string; template: Template } | null {
    const match = original.match(/^(\w+)\s+(\d+)\s+(\w+)\s+(\w+)\s+(.+)$/i);
    if (!match) return null;

    const [, verb, number, material, item, rest] = match;

    // Check if all words are in library
    const verbEntry = this.wordLibrary.getWord(verb);
    const materialEntry = this.wordLibrary.getWord(material);
    const itemEntry = this.wordLibrary.getWord(item);

    if (!verbEntry || !materialEntry || !itemEntry) return null;

    // Create pattern key (structure independent of specific values)
    const key = `${verb.toLowerCase()}_N_MATERIAL_ITEM_${rest.toLowerCase()}`;

    return {
      key,
      template: {
        patternEN: original,
        patternRU: translated,
        slots: {
          verb: verb.toLowerCase(),
          material: material.toLowerCase(),
          item: item.toLowerCase(),
          rest: rest.toLowerCase()
        },
        mode: 'smart'
      }
    };
  }

  /**
   * Try to translate using templates
   */
  tryTranslate(text: string): string | null {
    try {
      // Try smart mode first
      const smartResult = this.tryTranslateSmart(text);
      if (smartResult) return smartResult;

      // Fall back to simple exact matching
      const words = text.trim().split(/\s+/);
      if (words.length < 2) return null;

      const key = words.map(w => w.toLowerCase()).join('_');
      const template = this.templates.get(key);

      if (template && template.mode === 'simple') {
        console.log(`[template-cache] Found template (simple): "${key}"`);
        return template.patternRU;
      }

      return null;

    } catch (error) {
      console.log('[template-cache] Error:', error);
      return null;
    }
  }

  /**
   * Try smart translation with substitution
   */
  private tryTranslateSmart(text: string): string | null {
    const match = text.match(/^(\w+)\s+(\d+)\s+(\w+)\s+(\w+)\s+(.+)$/i);
    if (!match) return null;

    const [, verb, number, material, item, rest] = match;

    // Build pattern key
    const key = `${verb.toLowerCase()}_N_MATERIAL_ITEM_${rest.toLowerCase()}`;

    // Find matching template
    const template = this.templates.get(key);
    if (!template || template.mode !== 'smart') return null;

    // Get word entries for substitution
    const materialEntry = this.wordLibrary.getWord(material);
    const itemEntry = this.wordLibrary.getWord(item);
    const verbEntry = this.wordLibrary.getWord(verb);

    if (!materialEntry || !itemEntry || !verbEntry) return null;

    // Resolve number
    const tokens = text.split(/\s+/);
    const numberInfo = this.numberResolver.resolve(tokens);

    // Decline item (noun)
    const declinedItem = this.agreementEngine.declineNoun(itemEntry, numberInfo.count, numberInfo.isPlural);

    // Agree material (adjective) with item
    const agreedMaterial = this.agreementEngine.agreeAdjective(materialEntry, itemEntry, numberInfo.isPlural, numberInfo.count);

    // Get verb form
    const verbForm = verbEntry.forms.imperative_pl || Object.values(verbEntry.forms)[0];

    // Get original word entries to find their forms in template
    const originalVerbEntry = this.wordLibrary.getWord(template.slots.verb);
    const originalMaterialEntry = this.wordLibrary.getWord(template.slots.material);
    const originalItemEntry = this.wordLibrary.getWord(template.slots.item);

    if (!originalVerbEntry || !originalMaterialEntry || !originalItemEntry) return null;

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

    // Replace material (adjective) forms
    for (const form of Object.values(originalMaterialEntry.forms)) {
      if (result.includes(form)) {
        result = result.replace(form, agreedMaterial);
        break;
      }
    }

    // Replace item (noun) forms
    for (const form of Object.values(originalItemEntry.forms)) {
      if (result.includes(form)) {
        result = result.replace(form, declinedItem);
        break;
      }
    }

    console.log(`[template-cache] Translated (smart): "${text}" → "${result}"`);
    return result;
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; smart: number; simple: number } {
    let smart = 0;
    let simple = 0;

    this.templates.forEach(template => {
      if (template.mode === 'smart') smart++;
      else simple++;
    });

    return { total: this.templates.size, smart, simple };
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
