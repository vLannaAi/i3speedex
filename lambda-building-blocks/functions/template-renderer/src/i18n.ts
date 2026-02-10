/**
 * i18n integration using i18next
 * Handles dictionary loading and translation
 */

import i18next, { TFunction } from 'i18next';
import { Language } from './types';
import { logger } from './logger';
import * as path from 'path';
import * as fs from 'fs';

export class I18nService {
  private initialized = false;
  private instances: Map<Language, typeof i18next> = new Map();

  /**
   * Initialize i18next for all supported languages
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const languages: Language[] = ['it', 'en', 'de', 'fr'];

      // Load dictionaries dynamically
      const dictionariesPath = path.join(__dirname, 'dictionaries');
      const resources: Record<Language, any> = {} as any;

      for (const lang of languages) {
        const dictPath = path.join(dictionariesPath, `${lang}.json`);
        const dictContent = fs.readFileSync(dictPath, 'utf-8');
        resources[lang] = JSON.parse(dictContent);
      }

      // Create an instance for each language
      for (const lang of languages) {
        const instance = i18next.createInstance();
        await instance.init({
          lng: lang,
          fallbackLng: 'it',
          resources: {
            [lang]: {
              translation: resources[lang].invoice,
            },
          },
          interpolation: {
            escapeValue: false, // Not needed for HTML (Handlebars escapes)
          },
          returnEmptyString: false,
          returnNull: false,
        });

        this.instances.set(lang, instance);
      }

      this.initialized = true;
      logger.info('i18n initialized for all languages', {
        languages: languages.join(', '),
      });
    } catch (error) {
      logger.error('Failed to initialize i18n', error);
      throw error;
    }
  }

  /**
   * Get translation function for a specific language
   */
  getTranslator(language: Language): TFunction {
    const instance = this.instances.get(language);
    if (!instance) {
      logger.warn(`Language ${language} not found, falling back to Italian`);
      return this.instances.get('it')!.t;
    }
    return instance.t;
  }

  /**
   * Translate a key for a specific language
   */
  translate(key: string, language: Language, options?: any): string {
    const t = this.getTranslator(language);
    const translated = t(key, options);

    // Convert to string if needed
    const translatedStr = String(translated);

    // If translation returns the key itself, it wasn't found
    if (translatedStr === key) {
      logger.warn(`Translation not found`, {
        key,
        language,
      });
      return `??${key}??`;
    }

    return translatedStr;
  }

  /**
   * Check if a translation key exists
   */
  hasKey(key: string, language: Language): boolean {
    const instance = this.instances.get(language);
    if (!instance) {
      return false;
    }
    return instance.exists(key);
  }

  /**
   * Get all keys for a language (useful for debugging)
   */
  getKeys(language: Language): string[] {
    const instance = this.instances.get(language);
    if (!instance) {
      return [];
    }

    const store = instance.getResourceBundle(language, 'translation');
    return store ? Object.keys(store) : [];
  }
}

// Singleton instance
export const i18nService = new I18nService();
