import { PdfOptions } from './pdf-generator';

export interface PdfGenerationRequest {
  html: string;
  options?: PdfOptions;
  outputFormat?: 'base64' | 's3' | 'url';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate PDF generation request input
 */
export function validateInput(body: any): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!body) {
    errors.push('Request body is required');
    return { valid: false, errors };
  }

  if (!body.html) {
    errors.push('html field is required');
  } else if (typeof body.html !== 'string') {
    errors.push('html must be a string');
  } else if (body.html.trim().length === 0) {
    errors.push('html cannot be empty');
  } else if (body.html.length > 10 * 1024 * 1024) {
    // 10MB limit
    errors.push('html exceeds maximum size of 10MB');
  }

  // Validate output format
  if (body.outputFormat) {
    const validFormats = ['base64', 's3', 'url'];
    if (!validFormats.includes(body.outputFormat)) {
      errors.push(`outputFormat must be one of: ${validFormats.join(', ')}`);
    }
  }

  // Validate options if provided
  if (body.options) {
    if (typeof body.options !== 'object') {
      errors.push('options must be an object');
    } else {
      validatePdfOptions(body.options, errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate PDF options
 */
function validatePdfOptions(options: any, errors: string[]): void {
  // Validate format
  if (options.format) {
    const validFormats = ['A4', 'A3', 'Letter', 'Legal'];
    if (!validFormats.includes(options.format)) {
      errors.push(`options.format must be one of: ${validFormats.join(', ')}`);
    }
  }

  // Validate margin
  if (options.margin) {
    if (typeof options.margin !== 'object') {
      errors.push('options.margin must be an object');
    } else {
      const marginFields = ['top', 'right', 'bottom', 'left'];
      for (const field of marginFields) {
        if (options.margin[field] && typeof options.margin[field] !== 'string') {
          errors.push(`options.margin.${field} must be a string (e.g., "10mm")`);
        }
      }
    }
  }

  // Validate boolean fields
  const booleanFields = ['printBackground', 'landscape', 'displayHeaderFooter', 'preferCSSPageSize'];
  for (const field of booleanFields) {
    if (options[field] !== undefined && typeof options[field] !== 'boolean') {
      errors.push(`options.${field} must be a boolean`);
    }
  }

  // Validate scale
  if (options.scale !== undefined) {
    if (typeof options.scale !== 'number') {
      errors.push('options.scale must be a number');
    } else if (options.scale < 0.1 || options.scale > 2) {
      errors.push('options.scale must be between 0.1 and 2');
    }
  }

  // Validate templates
  if (options.headerTemplate !== undefined && typeof options.headerTemplate !== 'string') {
    errors.push('options.headerTemplate must be a string');
  }
  if (options.footerTemplate !== undefined && typeof options.footerTemplate !== 'string') {
    errors.push('options.footerTemplate must be a string');
  }
}

/**
 * Sanitize HTML input to prevent XSS and other attacks
 * Note: Puppeteer runs in a sandboxed environment, but we still sanitize
 */
export function sanitizeHtml(html: string): string {
  // Remove any <script> tags that might execute during PDF generation
  // Puppeteer sandbox prevents actual XSS, but we clean for safety
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  return sanitized;
}
