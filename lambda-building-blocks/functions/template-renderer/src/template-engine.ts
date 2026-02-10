/**
 * Template engine using Handlebars
 */

import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Language, TemplateData } from './types';
import { registerHelpers } from './helpers';
import { logger } from './logger';

export interface RenderOptions {
  template: string;
  language: Language;
  data: TemplateData;
}

export interface RenderResult {
  html: string;
  renderTime: number;
}

export class TemplateEngine {
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private initialized = false;

  /**
   * Initialize the template engine and precompile templates
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Precompile invoice template
      await this.compileTemplate('invoice');

      this.initialized = true;
      logger.info('Template engine initialized');
    } catch (error) {
      logger.error('Failed to initialize template engine', error);
      throw error;
    }
  }

  /**
   * Compile a template from file
   */
  private async compileTemplate(templateName: string): Promise<void> {
    const templatePath = path.join(
      __dirname,
      'templates',
      `${templateName}.hbs`
    );

    try {
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const compiled = Handlebars.compile(templateContent, {
        strict: false,
        noEscape: false,
      });

      this.compiledTemplates.set(templateName, compiled);
      logger.debug(`Template compiled: ${templateName}`);
    } catch (error) {
      logger.error(`Failed to compile template: ${templateName}`, error);
      throw new Error(`Template not found or invalid: ${templateName}`);
    }
  }

  /**
   * Render a template with data
   */
  async render(options: RenderOptions): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      // Get compiled template
      const template = this.compiledTemplates.get(options.template);
      if (!template) {
        throw new Error(`Template not found: ${options.template}`);
      }

      // Register helpers for this language
      registerHelpers(options.language);

      // Prepare context data
      const context = {
        ...options.data,
        _language: options.language,
        _template: options.template,
      };

      // Render template
      const html = template(context);

      const renderTime = Date.now() - startTime;

      logger.debug('Template rendered', {
        template: options.template,
        language: options.language,
        renderTime,
        htmlLength: html.length,
      });

      return {
        html,
        renderTime,
      };
    } catch (error) {
      logger.error('Failed to render template', error, {
        template: options.template,
        language: options.language,
      });
      throw error;
    }
  }

  /**
   * Check if a template exists
   */
  hasTemplate(templateName: string): boolean {
    return this.compiledTemplates.has(templateName);
  }

  /**
   * Get list of available templates
   */
  getTemplates(): string[] {
    return Array.from(this.compiledTemplates.keys());
  }

  /**
   * Clear compiled templates (useful for testing)
   */
  clearCache(): void {
    this.compiledTemplates.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const templateEngine = new TemplateEngine();
