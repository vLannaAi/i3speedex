import { validateInput, sanitizeHtml } from '../src/validator';

describe('Validator', () => {
  describe('validateInput', () => {
    it('should accept valid input', () => {
      const input = {
        html: '<html><body>Test</body></html>',
        options: {
          format: 'A4',
          printBackground: true
        },
        outputFormat: 'base64'
      };

      const result = validateInput(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing html', () => {
      const input = {
        options: {}
      };

      const result = validateInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('html field is required');
    });

    it('should reject empty html', () => {
      const input = {
        html: '   '
      };

      const result = validateInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('html cannot be empty');
    });

    it('should reject non-string html', () => {
      const input = {
        html: 123
      };

      const result = validateInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('html must be a string');
    });

    it('should reject html exceeding size limit', () => {
      const input = {
        html: 'x'.repeat(11 * 1024 * 1024) // 11MB
      };

      const result = validateInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('html exceeds maximum size of 10MB');
    });

    it('should reject invalid outputFormat', () => {
      const input = {
        html: '<html><body>Test</body></html>',
        outputFormat: 'invalid'
      };

      const result = validateInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('outputFormat must be one of: base64, s3, url');
    });

    it('should reject invalid format option', () => {
      const input = {
        html: '<html><body>Test</body></html>',
        options: {
          format: 'B5'
        }
      };

      const result = validateInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('options.format must be one of: A4, A3, Letter, Legal');
    });

    it('should reject invalid scale', () => {
      const input = {
        html: '<html><body>Test</body></html>',
        options: {
          scale: 3
        }
      };

      const result = validateInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('options.scale must be between 0.1 and 2');
    });

    it('should accept valid margin', () => {
      const input = {
        html: '<html><body>Test</body></html>',
        options: {
          margin: {
            top: '10mm',
            right: '15mm',
            bottom: '10mm',
            left: '15mm'
          }
        }
      };

      const result = validateInput(input);
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const html = '<html><body><script>alert("XSS")</script><p>Test</p></body></html>';
      const sanitized = sanitizeHtml(html);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Test</p>');
    });

    it('should remove event handlers', () => {
      const html = '<button onclick="alert(1)">Click</button>';
      const sanitized = sanitizeHtml(html);
      expect(sanitized).not.toContain('onclick');
    });

    it('should preserve safe HTML', () => {
      const html = '<div><h1>Title</h1><p>Paragraph</p></div>';
      const sanitized = sanitizeHtml(html);
      expect(sanitized).toBe(html);
    });
  });
});
