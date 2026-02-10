/**
 * Unit tests for LLM-optimized email extraction pipeline
 * Tests preprocessing, validation, and cultural name handling
 */

import {
  preprocessForLLM,
  isServiceAddress,
  detectLocalPartPattern,
  mapTitleToGenre,
  batchPreprocessForLLM,
  capitalizeProper,
} from '../src/parser';
import {
  validateExtractionResult,
  classifyExtractionStatus,
  batchValidateResults,
  getExtractionMetrics,
  computeInitial,
  computeName3,
} from '../src/extraction-validator';
import { LLMExtractionResult } from '../src/types';

describe('Preprocessing for LLM', () => {
  describe('preprocessForLLM', () => {
    it('should extract clean email and display name from RFC 5322 format', () => {
      const result = preprocessForLLM('"John Smith" <john.smith@example.com>');

      expect(result.cleanedEmail).toBe('john.smith@example.com');
      expect(result.cleanedDisplay).toBe('John Smith');
      expect(result.domain).toBe('example.com');
      expect(result.localPart).toBe('john.smith');
    });

    it('should handle Italian format with company suffix', () => {
      const result = preprocessForLLM('Mario Bianchi - Acme S.R.L. <m.bianchi@acme.it>');

      expect(result.cleanedEmail).toBe('m.bianchi@acme.it');
      expect(result.cleanedDisplay).toBe('Mario Bianchi');
      expect(result.domain).toBe('acme.it');
    });

    it('should handle German format with umlauts', () => {
      const result = preprocessForLLM('Herr Hans Müller <h.mueller@firma.de>');

      expect(result.cleanedEmail).toBe('h.mueller@firma.de');
      expect(result.cleanedDisplay).toBe('Herr Hans Müller');
      expect(result.domain).toBe('firma.de');
    });

    it('should handle plain email without display name', () => {
      const result = preprocessForLLM('john.smith@domain.com');

      expect(result.cleanedEmail).toBe('john.smith@domain.com');
      expect(result.cleanedDisplay).toBeNull();
      expect(result.domain).toBe('domain.com');
    });

    it('should reject display name that is actually an email', () => {
      const result = preprocessForLLM('john@old.com <john.new@domain.com>');

      expect(result.cleanedEmail).toBe('john.new@domain.com');
      expect(result.cleanedDisplay).toBeNull(); // Email as display should be ignored
    });

    it('should sanitize leading garbage characters', () => {
      const result = preprocessForLLM('\t- "John Smith" <john@example.com>');

      expect(result.cleanedEmail).toBe('john@example.com');
      expect(result.cleanedDisplay).toBe('John Smith');
    });

    it('should include domain convention when provided', () => {
      const result = preprocessForLLM('john.smith@company.com', 'firstname.lastname');

      expect(result.domainConvention).toBe('firstname.lastname');
    });

    it('should handle empty input gracefully', () => {
      const result = preprocessForLLM('');

      expect(result.cleanedEmail).toBe('');
      expect(result.cleanedDisplay).toBeNull();
    });

    it('should handle invalid email format', () => {
      const result = preprocessForLLM('not-an-email');

      expect(result.cleanedEmail).toBe('');
    });
  });

  describe('isServiceAddress', () => {
    it('should detect common service addresses', () => {
      expect(isServiceAddress('info@company.com')).toBe(true);
      expect(isServiceAddress('sales@company.com')).toBe(true);
      expect(isServiceAddress('support@company.com')).toBe(true);
      expect(isServiceAddress('noreply@company.com')).toBe(true);
      expect(isServiceAddress('admin@company.com')).toBe(true);
    });

    it('should detect Italian service addresses', () => {
      expect(isServiceAddress('vendite@azienda.it')).toBe(true);
      expect(isServiceAddress('amministrazione@azienda.it')).toBe(true);
      expect(isServiceAddress('contatti@azienda.it')).toBe(true);
    });

    it('should detect German service addresses', () => {
      expect(isServiceAddress('vertrieb@firma.de')).toBe(true);
      expect(isServiceAddress('kontakt@firma.de')).toBe(true);
    });

    it('should not flag personal addresses', () => {
      expect(isServiceAddress('mario.rossi@company.com')).toBe(false);
      expect(isServiceAddress('hans.mueller@firma.de')).toBe(false);
    });
  });

  describe('detectLocalPartPattern', () => {
    it('should detect firstname.lastname pattern', () => {
      const result = detectLocalPartPattern('john.smith');

      expect(result.pattern).toBe('firstname.lastname');
      expect(result.givenHint).toBe('John');
      expect(result.surnameHint).toBe('Smith');
    });

    it('should detect f.lastname pattern', () => {
      const result = detectLocalPartPattern('j.smith');

      expect(result.pattern).toBe('f.lastname');
      expect(result.givenHint).toBe('J');
      expect(result.surnameHint).toBe('Smith');
    });

    it('should detect camelCase pattern', () => {
      const result = detectLocalPartPattern('jSmith');

      expect(result.pattern).toBe('flastname');
      expect(result.givenHint).toBe('J');
      expect(result.surnameHint).toBe('Smith');
    });

    it('should return null for unrecognized patterns', () => {
      const result = detectLocalPartPattern('admin');

      expect(result.pattern).toBeNull();
    });
  });

  describe('mapTitleToGenre', () => {
    it('should map male titles to Mr.', () => {
      expect(mapTitleToGenre('Mr.')).toBe('Mr.');
      expect(mapTitleToGenre('Herr')).toBe('Mr.');
      expect(mapTitleToGenre('Sig.')).toBe('Mr.');
      expect(mapTitleToGenre('Signor')).toBe('Mr.');
    });

    it('should map female titles to Ms.', () => {
      expect(mapTitleToGenre('Ms.')).toBe('Ms.');
      expect(mapTitleToGenre('Mrs.')).toBe('Ms.');
      expect(mapTitleToGenre('Frau')).toBe('Ms.');
      expect(mapTitleToGenre('Sig.ra')).toBe('Ms.');
      expect(mapTitleToGenre('Signora')).toBe('Ms.');
    });

    it('should return null for neutral titles', () => {
      expect(mapTitleToGenre('Dr.')).toBeNull();
      expect(mapTitleToGenre('Prof.')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(mapTitleToGenre(null)).toBeNull();
    });
  });

  describe('batchPreprocessForLLM', () => {
    it('should preprocess multiple inputs', () => {
      const inputs = [
        '"John Smith" <john@example.com>',
        'jane.doe@example.com',
      ];

      const results = batchPreprocessForLLM(inputs);

      expect(results).toHaveLength(2);
      expect(results[0].cleanedEmail).toBe('john@example.com');
      expect(results[1].cleanedEmail).toBe('jane.doe@example.com');
    });

    it('should apply domain conventions when available', () => {
      const inputs = ['john.smith@company.com'];
      const conventions = new Map([['company.com', 'firstname.lastname']]);

      const results = batchPreprocessForLLM(inputs, conventions);

      expect(results[0].domainConvention).toBe('firstname.lastname');
    });
  });
});

describe('Extraction Validation', () => {
  describe('validateExtractionResult', () => {
    it('should accept valid extraction result', () => {
      const result: Partial<LLMExtractionResult> = {
        name1: 'John',
        name2: 'Smith',
        genre: 'Mr.',
        email: 'john.smith@example.com',
        domain: 'example.com',
        isPersonal: true,
        confidence: 0.95,
        reasoning: 'Clear name structure',
      };

      const validation = validateExtractionResult(result);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.sanitizedResult).toBeDefined();
    });

    it('should reject result with email in name field', () => {
      const result: Partial<LLMExtractionResult> = {
        name1: 'john@example.com', // Invalid: email in name
        name2: 'Smith',
        email: 'john.smith@example.com',
        confidence: 0.5,
      };

      const validation = validateExtractionResult(result);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('@'))).toBe(true);
    });

    it('should reject result with name too long', () => {
      const result: Partial<LLMExtractionResult> = {
        name1: 'A'.repeat(100), // Too long
        name2: 'Smith',
        email: 'john@example.com',
        confidence: 0.5,
      };

      const validation = validateExtractionResult(result);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('length'))).toBe(true);
    });

    it('should reject result with common email prefix as name', () => {
      const result: Partial<LLMExtractionResult> = {
        name1: 'info', // Invalid: common email prefix
        name2: 'Company',
        email: 'info@company.com',
        confidence: 0.5,
      };

      const validation = validateExtractionResult(result);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('email prefix'))).toBe(true);
    });

    it('should reject result with invalid email format', () => {
      const result: Partial<LLMExtractionResult> = {
        name1: 'John',
        name2: 'Smith',
        email: 'not-an-email',
        confidence: 0.5,
      };

      const validation = validateExtractionResult(result);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('email'))).toBe(true);
    });

    it('should warn about service address marked as personal', () => {
      const result: Partial<LLMExtractionResult> = {
        name1: null,
        name2: null,
        email: 'info@company.com',
        isPersonal: true, // Incorrect
        confidence: 0.5,
      };

      const validation = validateExtractionResult(result);

      // Should still be valid but with warnings
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.some(w => w.includes('service'))).toBe(true);
    });

    it('should reject result with URL in name field', () => {
      const result: Partial<LLMExtractionResult> = {
        name1: 'https://example.com',
        name2: 'Smith',
        email: 'john@example.com',
        confidence: 0.5,
      };

      const validation = validateExtractionResult(result);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('URL'))).toBe(true);
    });

    it('should reject result with numeric-only name', () => {
      const result: Partial<LLMExtractionResult> = {
        name1: '12345',
        name2: 'Smith',
        email: 'john@example.com',
        confidence: 0.5,
      };

      const validation = validateExtractionResult(result);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('numeric'))).toBe(true);
    });
  });

  describe('classifyExtractionStatus', () => {
    it('should classify high confidence with names as extracted_high', () => {
      const result: LLMExtractionResult = {
        name1: 'John',
        name2: 'Smith',
        name1pre: 'J.',
        name2pre: 'S.',
        name3: null,
        genre: 'Mr.',
        email: 'john@example.com',
        domain: 'example.com',
        isPersonal: true,
        confidence: 0.90,
        extractionStatus: 'extracted_medium',
        reasoning: 'test',
      };

      expect(classifyExtractionStatus(result)).toBe('extracted_high');
    });

    it('should downgrade high confidence without names to extracted_medium', () => {
      const result: LLMExtractionResult = {
        name1: 'John',
        name2: null, // Missing surname
        name1pre: 'J.',
        name2pre: null,
        name3: null,
        genre: null,
        email: 'john@example.com',
        domain: 'example.com',
        isPersonal: true,
        confidence: 0.90,
        extractionStatus: 'extracted_high',
        reasoning: 'test',
      };

      expect(classifyExtractionStatus(result)).toBe('extracted_medium');
    });

    it('should classify service address as not_applicable', () => {
      const result: LLMExtractionResult = {
        name1: null,
        name2: null,
        name1pre: null,
        name2pre: null,
        name3: null,
        genre: null,
        email: 'info@company.com',
        domain: 'company.com',
        isPersonal: false,
        confidence: 0.95,
        extractionStatus: 'extracted_high',
        reasoning: 'test',
      };

      expect(classifyExtractionStatus(result)).toBe('not_applicable');
    });

    it('should classify low confidence as extracted_low', () => {
      const result: LLMExtractionResult = {
        name1: 'John',
        name2: 'Smith',
        name1pre: 'J.',
        name2pre: 'S.',
        name3: null,
        genre: null,
        email: 'john@example.com',
        domain: 'example.com',
        isPersonal: true,
        confidence: 0.40,
        extractionStatus: 'extracted_medium',
        reasoning: 'test',
      };

      expect(classifyExtractionStatus(result)).toBe('extracted_low');
    });
  });

  describe('batchValidateResults', () => {
    it('should validate multiple results', () => {
      const results: Partial<LLMExtractionResult>[] = [
        {
          name1: 'John',
          name2: 'Smith',
          email: 'john@example.com',
          confidence: 0.9,
        },
        {
          name1: 'info', // Invalid
          email: 'info@company.com',
          confidence: 0.5,
        },
      ];

      const validations = batchValidateResults(results);

      expect(validations).toHaveLength(2);
      expect(validations[0].isValid).toBe(true);
      expect(validations[1].isValid).toBe(false);
    });
  });

  describe('getExtractionMetrics', () => {
    it('should calculate metrics for batch results', () => {
      const results: LLMExtractionResult[] = [
        {
          name1: 'John',
          name2: 'Smith',
          name1pre: 'J.',
          name2pre: 'S.',
          name3: null,
          genre: 'Mr.',
          email: 'john@example.com',
          domain: 'example.com',
          isPersonal: true,
          confidence: 0.95,
          extractionStatus: 'extracted_high',
          reasoning: 'test',
        },
        {
          name1: 'Jane',
          name2: 'Doe',
          name1pre: 'J.',
          name2pre: 'D.',
          name3: null,
          genre: 'Ms.',
          email: 'jane@example.com',
          domain: 'example.com',
          isPersonal: true,
          confidence: 0.75,
          extractionStatus: 'extracted_medium',
          reasoning: 'test',
        },
        {
          name1: null,
          name2: null,
          name1pre: null,
          name2pre: null,
          name3: null,
          genre: null,
          email: 'info@company.com',
          domain: 'company.com',
          isPersonal: false,
          confidence: 0.99,
          extractionStatus: 'not_applicable',
          reasoning: 'test',
        },
      ];

      const metrics = getExtractionMetrics(results);

      expect(metrics.total).toBe(3);
      expect(metrics.highConfidence).toBe(1);
      expect(metrics.mediumConfidence).toBe(1);
      expect(metrics.notApplicable).toBe(1);
      expect(metrics.withBothNames).toBe(2);
      expect(metrics.withGenre).toBe(2);
      expect(metrics.averageConfidence).toBeCloseTo(0.896, 2);
    });

    it('should handle empty results array', () => {
      const metrics = getExtractionMetrics([]);

      expect(metrics.total).toBe(0);
      expect(metrics.averageConfidence).toBe(0);
    });
  });
});

describe('Cultural Name Handling', () => {
  describe('Italian names', () => {
    it('should handle Italian honorifics in display name', () => {
      const result = preprocessForLLM('Sig. Giovanni Rossi <g.rossi@azienda.it>');

      expect(result.cleanedEmail).toBe('g.rossi@azienda.it');
      expect(result.cleanedDisplay).toBe('Sig. Giovanni Rossi');
    });

    it('should handle Italian female honorific', () => {
      const result = preprocessForLLM('Sig.ra Maria Bianchi <m.bianchi@azienda.it>');

      expect(result.cleanedDisplay).toBe('Sig.ra Maria Bianchi');
    });

    it('should remove Italian company suffixes', () => {
      const result = preprocessForLLM('Marco Rossi - Azienda S.R.L. <marco@azienda.it>');

      expect(result.cleanedDisplay).toBe('Marco Rossi');
    });
  });

  describe('German names', () => {
    it('should handle German honorifics', () => {
      const result = preprocessForLLM('Herr Dr. Klaus Weber <k.weber@firma.de>');

      expect(result.cleanedDisplay).toBe('Herr Dr. Klaus Weber');
    });

    it('should handle German female honorific', () => {
      const result = preprocessForLLM('Frau Anna Schmidt <a.schmidt@firma.de>');

      expect(result.cleanedDisplay).toBe('Frau Anna Schmidt');
    });

    it('should handle German umlauts', () => {
      const result = preprocessForLLM('Hans Müller <hans.mueller@firma.de>');

      expect(result.cleanedEmail).toBe('hans.mueller@firma.de');
      expect(result.cleanedDisplay).toBe('Hans Müller');
    });
  });

  describe('Asian names', () => {
    it('should preserve Chinese name order for LLM interpretation', () => {
      // The preprocessor preserves the display name; LLM handles interpretation
      const result = preprocessForLLM('Wang Li <wang.li@company.cn>');

      expect(result.cleanedEmail).toBe('wang.li@company.cn');
      expect(result.cleanedDisplay).toBe('Wang Li');
    });

    it('should handle Japanese domain', () => {
      const result = preprocessForLLM('Tanaka Yuki <yuki.tanaka@company.jp>');

      expect(result.domain).toBe('company.jp');
      expect(result.cleanedDisplay).toBe('Tanaka Yuki');
    });
  });

  describe('English names', () => {
    it('should handle hyphenated surnames', () => {
      const result = preprocessForLLM("Sarah O'Brien-Smith <sarah.obriensmith@corp.com>");

      expect(result.cleanedDisplay).toBe("Sarah O'Brien-Smith");
    });

    it('should handle "Lastname, Firstname" format', () => {
      const result = preprocessForLLM('Smith, John <john.smith@example.com>');

      expect(result.cleanedDisplay).toBe('Smith, John');
    });
  });
});

describe('Edge Cases', () => {
  describe('Malformed input handling', () => {
    it('should handle email in both display and address positions', () => {
      const result = preprocessForLLM('john@old.com <john.new@domain.com>');

      // Should use the actual email, ignore display
      expect(result.cleanedEmail).toBe('john.new@domain.com');
      expect(result.cleanedDisplay).toBeNull();
    });

    it('should handle MIME encoding artifacts', () => {
      const result = preprocessForLLM('=?UTF-8?Q? leftover?= John Smith <john@example.com>');

      expect(result.cleanedEmail).toBe('john@example.com');
      // MIME artifacts should be cleaned
    });

    it('should handle multiple spaces', () => {
      const result = preprocessForLLM('John    Smith  <john@example.com>');

      expect(result.cleanedDisplay).toBe('John Smith');
    });

    it('should handle leading/trailing special characters', () => {
      const result = preprocessForLLM('---"John Smith"--- <john@example.com>');

      expect(result.cleanedEmail).toBe('john@example.com');
    });
  });

  describe('Company name edge cases', () => {
    it('should remove company suffix after em-dash', () => {
      const result = preprocessForLLM('Anna Verdi — Acme Corp <anna@acme.it>');

      expect(result.cleanedDisplay).toBe('Anna Verdi');
    });

    it('should handle GmbH suffix', () => {
      const result = preprocessForLLM('Hans Müller - Schmidt GmbH <hans@schmidt.de>');

      expect(result.cleanedDisplay).toBe('Hans Müller');
    });
  });
});

describe('capitalizeProper', () => {
  it('should capitalize basic names', () => {
    expect(capitalizeProper('marco')).toBe('Marco');
    expect(capitalizeProper('john')).toBe('John');
  });

  it('should handle all-caps names', () => {
    expect(capitalizeProper('ROSSI')).toBe('Rossi');
    expect(capitalizeProper('SMITH')).toBe('Smith');
  });

  it('should handle apostrophe names', () => {
    expect(capitalizeProper("o'brien")).toBe("O'Brien");
    expect(capitalizeProper("d'angelo")).toBe("D'Angelo");
  });

  it('should handle Mc prefix', () => {
    expect(capitalizeProper('mcdonald')).toBe('McDonald');
    expect(capitalizeProper('mccarthy')).toBe('McCarthy');
  });

  it('should handle Mac prefix (5+ chars)', () => {
    expect(capitalizeProper('macgregor')).toBe('MacGregor');
    expect(capitalizeProper('mackenzie')).toBe('MacKenzie');
  });

  it('should NOT apply Mac rule to false positives', () => {
    expect(capitalizeProper('mace')).toBe('Mace');
    expect(capitalizeProper('mack')).toBe('Mack');
    expect(capitalizeProper('maceo')).toBe('Maceo');
    expect(capitalizeProper('macro')).toBe('Macro');
  });

  it('should keep particles lowercase', () => {
    expect(capitalizeProper('van der Berg')).toBe('van der Berg');
    expect(capitalizeProper('di rossi')).toBe('di Rossi');
    expect(capitalizeProper('von müller')).toBe('von Müller');
    expect(capitalizeProper('de la cruz')).toBe('de la Cruz');
  });

  it('should preserve initials', () => {
    expect(capitalizeProper('M.')).toBe('M.');
    expect(capitalizeProper('J')).toBe('J');
  });

  it('should handle hyphenated names', () => {
    expect(capitalizeProper('smith-jones')).toBe('Smith-Jones');
    expect(capitalizeProper("o'brien-smith")).toBe("O'Brien-Smith");
  });

  it('should handle empty/null input', () => {
    expect(capitalizeProper('')).toBe('');
  });
});

describe('computeInitial', () => {
  it('should compute initial from a name', () => {
    expect(computeInitial('Marco')).toBe('M.');
    expect(computeInitial('Rossi')).toBe('R.');
    expect(computeInitial('Anna')).toBe('A.');
  });

  it('should normalize existing initials', () => {
    expect(computeInitial('M.')).toBe('M.');
    expect(computeInitial('M')).toBe('M.');
    expect(computeInitial('j.')).toBe('J.');
  });

  it('should return null for null name without email segment', () => {
    expect(computeInitial(null)).toBeNull();
    expect(computeInitial(null, null)).toBeNull();
  });

  it('should derive initial from email segment when name is null', () => {
    expect(computeInitial(null, 'm')).toBe('M.');
    expect(computeInitial(null, 'marco')).toBe('M.');
    expect(computeInitial(null, 'rossi')).toBe('R.');
  });
});

describe('sanitizeName with capitalization', () => {
  it('should capitalize names during sanitization', () => {
    const result = validateExtractionResult({
      name1: 'marco',
      name2: 'ROSSI',
      email: 'marco.rossi@example.com',
      confidence: 0.9,
    });

    expect(result.isValid).toBe(true);
    expect(result.sanitizedResult?.name1).toBe('Marco');
    expect(result.sanitizedResult?.name2).toBe('Rossi');
  });

  it('should compute initials during sanitization', () => {
    const result = validateExtractionResult({
      name1: 'Marco',
      name2: 'Rossi',
      email: 'm.rossi@example.com',
      confidence: 0.9,
    });

    expect(result.isValid).toBe(true);
    expect(result.sanitizedResult?.name1pre).toBe('M.');
    expect(result.sanitizedResult?.name2pre).toBe('R.');
  });

  it('should derive initials from email when names are null', () => {
    const result = validateExtractionResult({
      name1: null,
      name2: null,
      email: 'm.rossi@example.com',
      confidence: 0.5,
    });

    expect(result.isValid).toBe(true);
    expect(result.sanitizedResult?.name1pre).toBe('M.');
    expect(result.sanitizedResult?.name2pre).toBe('R.');
  });

  it('should handle Mc/Mac names in extraction results', () => {
    const result = validateExtractionResult({
      name1: 'sarah',
      name2: 'mcdonald',
      email: 's.mcdonald@example.com',
      confidence: 0.9,
    });

    expect(result.isValid).toBe(true);
    expect(result.sanitizedResult?.name1).toBe('Sarah');
    expect(result.sanitizedResult?.name2).toBe('McDonald');
  });

  it('should compute name3 for non-personal addresses during sanitization', () => {
    const result = validateExtractionResult({
      name1: null,
      name2: null,
      email: 'info@company.com',
      isPersonal: false,
      confidence: 0.95,
    });

    expect(result.isValid).toBe(true);
    expect(result.sanitizedResult?.name3).toBe('info');
  });
});

describe('computeName3', () => {
  describe('clean prefixes (no simplification)', () => {
    it('should return clean local part as-is', () => {
      expect(computeName3('info', false)).toBe('info');
      expect(computeName3('sales', false)).toBe('sales');
      expect(computeName3('noreply', false)).toBe('noreply');
      expect(computeName3('support', false)).toBe('support');
    });

    it('should lowercase the local part', () => {
      expect(computeName3('MAILER-DAEMON', false)).toBe('mailer-daemon');
      expect(computeName3('NoReply', false)).toBe('noreply');
      expect(computeName3('INFO', false)).toBe('info');
    });
  });

  describe('personal addresses', () => {
    it('should return null for personal addresses', () => {
      expect(computeName3('john.smith', true)).toBeNull();
      expect(computeName3('info', true)).toBeNull();
    });
  });

  describe('UUID stripping', () => {
    it('should strip UUID after + separator', () => {
      expect(computeName3('bounce-detection+06da38cd-379e-4e75-9873-c4ce19ec8710', false))
        .toBe('bounce-detection~');
    });

    it('should strip UUID after - separator', () => {
      expect(computeName3('bounce-abcdef01-2345-6789-abcd-ef0123456789', false))
        .toBe('bounce~');
    });

    it('should strip UUID after . separator', () => {
      expect(computeName3('reply.abcdef01-2345-6789-abcd-ef0123456789', false))
        .toBe('reply~');
    });
  });

  describe('long hex stripping', () => {
    it('should strip long hex tracking ID after +', () => {
      expect(computeName3('bounce+abcdef0123456789ab', false)).toBe('bounce~');
    });

    it('should strip long hex after -', () => {
      expect(computeName3('track-abcdef0123456789abcdef', false)).toBe('track~');
    });
  });

  describe('numeric suffix stripping', () => {
    it('should strip 3+ digit suffixes', () => {
      expect(computeName3('auto-reply-12345', false)).toBe('auto-reply~');
      expect(computeName3('notification_99999', false)).toBe('notification~');
    });

    it('should strip 2-digit suffixes', () => {
      expect(computeName3('alert_42', false)).toBe('alert~');
    });
  });

  describe('date-like suffix stripping', () => {
    it('should strip year suffix', () => {
      expect(computeName3('newsletter-2024', false)).toBe('newsletter~');
    });

    it('should strip year-quarter suffix', () => {
      expect(computeName3('newsletter-2024-q3', false)).toBe('newsletter~');
    });

    it('should strip quarter suffix', () => {
      expect(computeName3('report_q3', false)).toBe('report~');
    });
  });

  describe('edge cases', () => {
    it('should return null for empty local part', () => {
      expect(computeName3('', false)).toBeNull();
    });

    it('should keep original when remainder too short', () => {
      // After stripping, remainder is 1 char, so keep original
      expect(computeName3('a+abcdef01-2345-6789-abcd-ef0123456789', false)).toBe('a+abcdef01-2345-6789-abcd-ef0123456789');
    });

    it('should return null for personal addresses regardless of local part', () => {
      expect(computeName3('bounce+abcdef0123456789ab', true)).toBeNull();
    });
  });
});
