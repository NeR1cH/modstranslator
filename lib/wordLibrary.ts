/**
 * Word Library - Dictionary of words with all their forms
 * Stores Russian translations with morphological forms for proper agreement
 */

export interface WordEntry {
  pos: "noun" | "adjective" | "verb";
  gender?: "m" | "f" | "n"; // only for nouns
  forms: Record<string, string>; // all word forms
}

export class WordLibrary {
  private words: Map<string, WordEntry> = new Map();

  constructor() {
    this.initializeDefaultWords();
  }

  /**
   * Get word entry by English word
   * Returns null if word not found (does not throw)
   */
  getWord(en: string): WordEntry | null {
    return this.words.get(en.toLowerCase()) || null;
  }

  /**
   * Add or update word entry
   */
  addWord(en: string, entry: WordEntry): void {
    this.words.set(en.toLowerCase(), entry);
  }

  /**
   * Check if word exists in library
   */
  hasWord(en: string): boolean {
    return this.words.has(en.toLowerCase());
  }

  /**
   * Initialize library with default words
   */
  private initializeDefaultWords(): void {
    // Nouns (существительные)
    this.addWord("ingot", {
      pos: "noun",
      gender: "m",
      forms: {
        nom_sg: "слиток",    // именительный единственное (1 слиток)
        gen_sg: "слитка",    // родительный единственное (2 слитка)
        gen_pl: "слитков",   // родительный множественное (5 слитков)
        nom_pl: "слитки"     // именительный множественное (слитки)
      }
    });

    this.addWord("ingots", {
      pos: "noun",
      gender: "m",
      forms: {
        nom_sg: "слиток",
        gen_sg: "слитка",
        gen_pl: "слитков",
        nom_pl: "слитки"
      }
    });

    this.addWord("sword", {
      pos: "noun",
      gender: "m",
      forms: {
        nom_sg: "меч",
        gen_sg: "меча",
        gen_pl: "мечей",
        nom_pl: "мечи"
      }
    });

    this.addWord("pickaxe", {
      pos: "noun",
      gender: "f",
      forms: {
        nom_sg: "кирка",
        gen_sg: "кирки",
        gen_pl: "кирок",
        nom_pl: "кирки"
      }
    });

    this.addWord("ore", {
      pos: "noun",
      gender: "f",
      forms: {
        nom_sg: "руда",
        gen_sg: "руды",
        gen_pl: "руд",
        nom_pl: "руды"
      }
    });

    // Adjectives (прилагательные)
    this.addWord("iron", {
      pos: "adjective",
      forms: {
        adj_m_sg: "железный",   // мужской род единственное
        adj_f_sg: "железная",   // женский род единственное
        adj_n_sg: "железное",   // средний род единственное
        adj_pl: "железные",     // множественное число
        adj_gen_pl: "железных"  // родительный множественное (10 железных слитков)
      }
    });

    this.addWord("gold", {
      pos: "adjective",
      forms: {
        adj_m_sg: "золотой",
        adj_f_sg: "золотая",
        adj_n_sg: "золотое",
        adj_pl: "золотые",
        adj_gen_pl: "золотых"
      }
    });

    this.addWord("diamond", {
      pos: "adjective",
      forms: {
        adj_m_sg: "алмазный",
        adj_f_sg: "алмазная",
        adj_n_sg: "алмазное",
        adj_pl: "алмазные",
        adj_gen_pl: "алмазных"
      }
    });

    this.addWord("copper", {
      pos: "adjective",
      forms: {
        adj_m_sg: "медный",
        adj_f_sg: "медная",
        adj_n_sg: "медное",
        adj_pl: "медные",
        adj_gen_pl: "медных"
      }
    });

    this.addWord("raw", {
      pos: "adjective",
      forms: {
        adj_m_sg: "сырой",
        adj_f_sg: "сырая",
        adj_n_sg: "сырое",
        adj_pl: "сырые",
        adj_gen_pl: "сырых"
      }
    });

    // Verbs (глаголы)
    this.addWord("collect", {
      pos: "verb",
      forms: {
        imperative_pl: "Соберите",  // повелительное наклонение множественное
        imperative_sg: "Собери"     // повелительное наклонение единственное
      }
    });

    this.addWord("craft", {
      pos: "verb",
      forms: {
        imperative_pl: "Создайте",
        imperative_sg: "Создай"
      }
    });

    this.addWord("bring", {
      pos: "verb",
      forms: {
        imperative_pl: "Принесите",
        imperative_sg: "Принеси"
      }
    });
  }
}

// Singleton instance
let instance: WordLibrary | null = null;

export function getWordLibrary(): WordLibrary {
  if (!instance) {
    instance = new WordLibrary();
  }
  return instance;
}
