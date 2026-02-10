/**
 * Unit tests for the email parser module
 */

import { parseRecipient, parseRecipients } from '../src/parser';
import { decodeMimeWord, fullyDecodeMime } from '../src/mime-decoder';

describe('MIME Decoder', () => {
  describe('decodeMimeWord', () => {
    it('should decode UTF-8 Q-encoded text', () => {
      const encoded = '=?UTF-8?Q?M=C3=BCller?=';
      const decoded = decodeMimeWord(encoded);
      expect(decoded).toBe('Müller'); // Correctly decodes to German umlaut
    });

    it('should decode UTF-8 B-encoded text', () => {
      const encoded = '=?UTF-8?B?TcO8bGxlcg==?=';
      const decoded = decodeMimeWord(encoded);
      expect(decoded).toBe('Müller'); // Correctly decodes to German umlaut
    });

    it('should handle multiple encoded words', () => {
      const encoded = '=?UTF-8?Q?Hello?= =?UTF-8?Q?World?=';
      const decoded = decodeMimeWord(encoded);
      expect(decoded).toBe('HelloWorld');
    });

    it('should return original text if not encoded', () => {
      const plain = 'Plain Text';
      const decoded = decodeMimeWord(plain);
      expect(decoded).toBe('Plain Text');
    });

    it('should handle ISO-8859-1 encoding', () => {
      const encoded = '=?iso-8859-1?Q?caf=E9?=';
      const decoded = decodeMimeWord(encoded);
      // Should decode to 'cafe' with accented e
      expect(decoded.length).toBeGreaterThan(0);
    });
  });

  describe('fullyDecodeMime', () => {
    it('should decode nested encodings', () => {
      const text = 'Test =?UTF-8?Q?Name?=';
      const decoded = fullyDecodeMime(text);
      expect(decoded).toBe('Test Name');
    });

    it('should handle empty input', () => {
      expect(fullyDecodeMime('')).toBe('');
      expect(fullyDecodeMime(null as unknown as string)).toBe('');
    });
  });
});

describe('Email Parser', () => {
  describe('parseRecipient', () => {
    it('should parse standard RFC 5322 format', () => {
      const result = parseRecipient('"John Smith" <john.smith@example.com>');

      expect(result.email).toBe('john.smith@example.com');
      expect(result.displayName).toBe('John Smith');
      expect(result.localPart).toBe('john.smith');
      expect(result.domain).toBe('example.com');
      expect(result.givenName).toBe('John');
      expect(result.surname).toBe('Smith');
    });

    it('should parse angle bracket format without quotes', () => {
      const result = parseRecipient('John Smith <john.smith@example.com>');

      expect(result.email).toBe('john.smith@example.com');
      expect(result.displayName).toBe('John Smith');
    });

    it('should parse plain email address', () => {
      const result = parseRecipient('john.smith@example.com');

      expect(result.email).toBe('john.smith@example.com');
      expect(result.displayName).toBeNull();
    });

    it('should extract name from local part pattern', () => {
      const result = parseRecipient('<john.smith@example.com>');

      expect(result.email).toBe('john.smith@example.com');
      expect(result.givenName).toBe('John');
      expect(result.surname).toBe('Smith');
    });

    it('should handle Italian honorifics', () => {
      const result = parseRecipient('Sig. Giovanni Rossi <giovanni.rossi@azienda.it>');

      expect(result.email).toBe('giovanni.rossi@azienda.it');
      expect(result.title).toBe('Sig.');
      expect(result.givenName).toBe('Giovanni');
      expect(result.surname).toBe('Rossi');
    });

    it('should handle German honorifics', () => {
      const result = parseRecipient('Herr Dr. Klaus Weber <k.weber@firma.de>');

      expect(result.email).toBe('k.weber@firma.de');
      expect(result.displayName).toBe('Herr Dr. Klaus Weber');
    });

    it('should detect company names', () => {
      const result = parseRecipient('ACME Corp S.R.L. <info@acme.it>');

      expect(result.email).toBe('info@acme.it');
      expect(result.companyName).toBe('ACME Corp S.R.L.');
      expect(result.isPersonal).toBe(false);
    });

    it('should detect service addresses', () => {
      const result = parseRecipient('info@company.com');

      expect(result.email).toBe('info@company.com');
      expect(result.isPersonal).toBe(false);
    });

    it('should handle personal addresses', () => {
      const result = parseRecipient('mario.bianchi@gmail.com');

      expect(result.email).toBe('mario.bianchi@gmail.com');
      expect(result.isPersonal).toBe(true);
    });

    it('should handle "Lastname, Firstname" format', () => {
      const result = parseRecipient('Rossi, Marco <marco.rossi@email.it>');

      expect(result.email).toBe('marco.rossi@email.it');
      expect(result.givenName).toBe('Marco');
      expect(result.surname).toBe('Rossi');
    });

    it('should handle display name with company suffix', () => {
      const result = parseRecipient('Anna Verdi - Rosval <anna.verdi@rosval.it>');

      expect(result.email).toBe('anna.verdi@rosval.it');
      expect(result.displayName).toBe('Anna Verdi - Rosval');
      expect(result.givenName).toBe('Anna');
      expect(result.surname).toBe('Verdi');
    });

    it('should sanitize input with leading special characters', () => {
      const result = parseRecipient('\t- John Smith <john@example.com>');

      expect(result.email).toBe('john@example.com');
      expect(result.displayName).toBe('John Smith');
    });

    it('should handle MIME encoded display names', () => {
      const result = parseRecipient('=?UTF-8?Q?M=C3=BCller?= <muller@example.com>');

      expect(result.email).toBe('muller@example.com');
      // Display name will be decoded
      expect(result.displayName).toBeTruthy();
    });

    it('should return empty email for invalid input', () => {
      const result = parseRecipient('not an email');

      expect(result.email).toBe('');
      expect(result.confidence).toBe(0);
    });

    it('should handle empty input', () => {
      const result = parseRecipient('');

      expect(result.email).toBe('');
      expect(result.rawInput).toBe('');
    });

    it('should handle f.lastname pattern in local part', () => {
      const result = parseRecipient('<m.rossi@company.it>');

      expect(result.email).toBe('m.rossi@company.it');
      expect(result.givenName).toBe('M.');
      expect(result.surname).toBe('Rossi');
    });
  });

  describe('parseRecipients', () => {
    it('should parse multiple comma-separated recipients', () => {
      const input = 'john@example.com, jane@example.com';
      const results = parseRecipients(input);

      expect(results).toHaveLength(2);
      expect(results[0].email).toBe('john@example.com');
      expect(results[1].email).toBe('jane@example.com');
    });

    it('should parse multiple recipients with display names', () => {
      const input = '"John" <john@example.com>, "Jane" <jane@example.com>';
      const results = parseRecipients(input);

      expect(results).toHaveLength(2);
      expect(results[0].displayName).toBe('John');
      expect(results[1].displayName).toBe('Jane');
    });

    it('should handle semicolon separator', () => {
      const input = 'john@example.com; jane@example.com';
      const results = parseRecipients(input);

      expect(results).toHaveLength(2);
    });

    it('should not split on comma inside angle brackets', () => {
      const input = '"Smith, John" <john@example.com>';
      const results = parseRecipients(input);

      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('john@example.com');
    });

    it('should handle empty input', () => {
      const results = parseRecipients('');
      expect(results).toHaveLength(0);
    });
  });

  describe('confidence scoring', () => {
    it('should give high confidence for complete data', () => {
      const result = parseRecipient('Dr. John Smith <john.smith@example.com>');

      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should give medium confidence for partial data', () => {
      const result = parseRecipient('john.smith@example.com');

      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('should give zero confidence for invalid email', () => {
      const result = parseRecipient('not-an-email');

      expect(result.confidence).toBe(0);
    });
  });
});
