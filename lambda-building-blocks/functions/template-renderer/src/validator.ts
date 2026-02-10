/**
 * Input validation for template renderer requests
 */

import { TemplateRendererRequest, Language } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SUPPORTED_LANGUAGES: Language[] = ['it', 'en', 'de', 'fr'];
const SUPPORTED_TEMPLATES = ['invoice'];
const SUPPORTED_OUTPUT_FORMATS = ['html', 'text'];

export function validateRequest(request: any): ValidationResult {
  const errors: string[] = [];

  // Check if request is an object
  if (!request || typeof request !== 'object') {
    return {
      valid: false,
      errors: ['Request must be an object'],
    };
  }

  // Validate template
  if (!request.template) {
    errors.push('template is required');
  } else if (!SUPPORTED_TEMPLATES.includes(request.template)) {
    errors.push(
      `template must be one of: ${SUPPORTED_TEMPLATES.join(', ')}`
    );
  }

  // Validate language (optional)
  if (
    request.language &&
    !SUPPORTED_LANGUAGES.includes(request.language)
  ) {
    errors.push(
      `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`
    );
  }

  // Validate outputFormat (optional)
  if (
    request.outputFormat &&
    !SUPPORTED_OUTPUT_FORMATS.includes(request.outputFormat)
  ) {
    errors.push(
      `outputFormat must be one of: ${SUPPORTED_OUTPUT_FORMATS.join(', ')}`
    );
  }

  // Validate data
  if (!request.data) {
    errors.push('data is required');
    return { valid: false, errors };
  }

  if (typeof request.data !== 'object') {
    errors.push('data must be an object');
    return { valid: false, errors };
  }

  // Validate data.sale
  if (!request.data.sale) {
    errors.push('data.sale is required');
  } else {
    validateSale(request.data.sale, errors);
  }

  // Validate data.buyer
  if (!request.data.buyer) {
    errors.push('data.buyer is required');
  } else {
    validateBuyer(request.data.buyer, errors);
  }

  // Validate data.sale_lines
  if (!request.data.sale_lines) {
    errors.push('data.sale_lines is required');
  } else if (!Array.isArray(request.data.sale_lines)) {
    errors.push('data.sale_lines must be an array');
  } else if (request.data.sale_lines.length === 0) {
    // Warning, not error
    console.warn('data.sale_lines is empty');
  }

  // Optional: producer, banks, countries
  if (request.data.banks && !Array.isArray(request.data.banks)) {
    errors.push('data.banks must be an array');
  }

  if (request.data.countries && !Array.isArray(request.data.countries)) {
    errors.push('data.countries must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateSale(sale: any, errors: string[]): void {
  const required = ['id', 'number', 'year', 'status', 'currency'];

  for (const field of required) {
    if (sale[field] === undefined || sale[field] === null) {
      errors.push(`data.sale.${field} is required`);
    }
  }

  // Validate types
  if (sale.id && typeof sale.id !== 'number') {
    errors.push('data.sale.id must be a number');
  }

  if (sale.number && typeof sale.number !== 'number') {
    errors.push('data.sale.number must be a number');
  }

  if (sale.year && typeof sale.year !== 'number') {
    errors.push('data.sale.year must be a number');
  }

  // Validate status
  const validStatuses = [
    'new',
    'to verify',
    'proforma',
    'ready',
    'sent',
    'paid',
    'deleted',
  ];
  if (sale.status && !validStatuses.includes(sale.status)) {
    errors.push(
      `data.sale.status must be one of: ${validStatuses.join(', ')}`
    );
  }

  // Validate currency
  if (sale.currency && typeof sale.currency !== 'string') {
    errors.push('data.sale.currency must be a string');
  }
}

function validateBuyer(buyer: any, errors: string[]): void {
  const required = ['id', 'name', 'country', 'lang'];

  for (const field of required) {
    if (buyer[field] === undefined || buyer[field] === null) {
      errors.push(`data.buyer.${field} is required`);
    }
  }

  // Validate lang
  if (buyer.lang && !SUPPORTED_LANGUAGES.includes(buyer.lang)) {
    errors.push(
      `data.buyer.lang must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`
    );
  }
}

export function sanitizeRequest(
  request: TemplateRendererRequest
): TemplateRendererRequest {
  // Set defaults
  const sanitized: TemplateRendererRequest = {
    ...request,
    outputFormat: request.outputFormat || 'html',
    language: request.language || request.data.buyer.lang,
  };

  // Sanitize HTML inputs (remove script tags, dangerous content)
  // This is a basic sanitization - for production, consider using a library like DOMPurify
  if (sanitized.data.sale.sale_note) {
    sanitized.data.sale.sale_note = sanitizeHtml(
      sanitized.data.sale.sale_note
    );
  }

  if (sanitized.data.sale.note) {
    sanitized.data.sale.note = sanitizeHtml(sanitized.data.sale.note);
  }

  if (sanitized.data.sale.buyer_ref) {
    sanitized.data.sale.buyer_ref = sanitizeHtml(
      sanitized.data.sale.buyer_ref
    );
  }

  return sanitized;
}

function sanitizeHtml(html: string): string {
  if (!html) return html;

  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
}
