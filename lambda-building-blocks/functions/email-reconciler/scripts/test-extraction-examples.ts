/**
 * Test script to run the extraction pipeline on real-world examples
 * Run with: npx ts-node scripts/test-extraction-examples.ts
 */

import {
  preprocessForLLM,
  isServiceAddress,
  detectLocalPartPattern,
  mapTitleToGenre,
} from '../src/parser';
import {
  validateExtractionResult,
  classifyExtractionStatus,
} from '../src/extraction-validator';
import { LLMExtractionResult } from '../src/types';

// Real-world email examples to test
const REAL_EXAMPLES = [
  // Italian examples
  '"Sig. Marco Rossi" <m.rossi@company.it>',
  'Sig.ra Maria Bianchi <maria.bianchi@azienda.it>',
  'Giovanni Verdi - Acme S.R.L. <g.verdi@acme.it>',
  'Dott. Alessandro Conti <a.conti@studio.it>',
  'info@azienda.it',
  'vendite@company.it',

  // German examples
  'Herr Hans Müller <h.mueller@firma.de>',
  'Frau Dr. Anna Schmidt <anna.schmidt@unternehmen.de>',
  'Klaus Weber - Schmidt GmbH <k.weber@schmidt.de>',
  'kontakt@firma.de',

  // English examples
  '"John Smith" <john.smith@example.com>',
  'Dr. Sarah O\'Brien-Smith <sarah.obriensmith@corp.com>',
  'Smith, John <john.smith@company.com>',
  'support@company.com',
  'noreply@notifications.example.com',

  // Asian examples (surname first)
  'Wang Li <wang.li@company.cn>',
  'Tanaka Yuki <yuki.tanaka@company.jp>',
  'Kim Minji <minji.kim@company.kr>',

  // Edge cases
  'john@old.com <john.new@domain.com>',  // Malformed - email in display
  '<firstname.lastname@domain.com>',      // No display name
  '   "  John Smith  "   <john@example.com>',  // Extra whitespace
  '=?UTF-8?Q?M=C3=BCller?= <muller@example.com>',  // MIME encoded
  'ACME CORP <info@acme.com>',            // Company name
  'm.rossi@company.it',                    // Plain email
  'j.smith@example.com',                   // Initial pattern
];

// Simulated LLM responses for testing validation
const SIMULATED_LLM_RESPONSES: Partial<LLMExtractionResult>[] = [
  // Valid extraction
  {
    name1: 'Marco',
    name2: 'Rossi',
    genre: 'Mr.',
    email: 'm.rossi@company.it',
    isPersonal: true,
    confidence: 0.95,
    reasoning: 'Italian honorific Sig. indicates male',
  },
  // Invalid - email in name field
  {
    name1: 'john@example.com',
    name2: 'Smith',
    email: 'john.smith@example.com',
    confidence: 0.5,
    reasoning: 'test',
  },
  // Invalid - name too long
  {
    name1: 'A'.repeat(100),
    name2: 'Smith',
    email: 'john@example.com',
    confidence: 0.5,
    reasoning: 'test',
  },
  // Invalid - common email prefix as name
  {
    name1: 'info',
    name2: 'Company',
    email: 'info@company.com',
    confidence: 0.5,
    reasoning: 'test',
  },
  // Valid but low confidence
  {
    name1: 'Unknown',
    name2: null,
    email: 'user123@domain.com',
    isPersonal: true,
    confidence: 0.35,
    reasoning: 'Could not determine name structure',
  },
];

function printSeparator(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

function testPreprocessing() {
  printSeparator('PREPROCESSING TESTS');

  for (const input of REAL_EXAMPLES) {
    const result = preprocessForLLM(input);
    const isService = isServiceAddress(result.cleanedEmail);
    const pattern = detectLocalPartPattern(result.localPart);

    console.log(`\nInput: ${input}`);
    console.log(`  Email: ${result.cleanedEmail || '(none)'}`);
    console.log(`  Display: ${result.cleanedDisplay || '(none)'}`);
    console.log(`  Domain: ${result.domain}`);
    console.log(`  Local Part: ${result.localPart}`);
    console.log(`  Service Address: ${isService}`);
    if (pattern.pattern) {
      console.log(`  Pattern: ${pattern.pattern} → given="${pattern.givenHint}", surname="${pattern.surnameHint}"`);
    }
  }
}

function testValidation() {
  printSeparator('VALIDATION TESTS');

  for (const response of SIMULATED_LLM_RESPONSES) {
    const validation = validateExtractionResult(response);

    console.log(`\nInput: name1="${response.name1}", name2="${response.name2}", email="${response.email}"`);
    console.log(`  Valid: ${validation.isValid}`);
    if (validation.errors.length > 0) {
      console.log(`  Errors: ${validation.errors.join('; ')}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`  Warnings: ${validation.warnings.join('; ')}`);
    }
    if (validation.sanitizedResult) {
      console.log(`  Status: ${validation.sanitizedResult.extractionStatus}`);
      console.log(`  Confidence: ${validation.sanitizedResult.confidence}`);
    }
  }
}

function testTitleMapping() {
  printSeparator('TITLE → GENRE MAPPING');

  const titles = [
    'Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.',
    'Herr', 'Frau',
    'Sig.', 'Sig.ra', 'Signor', 'Signora',
    'Dott.', 'Dott.ssa', 'Ing.',
    'Prof.', 'Avv.',
  ];

  for (const title of titles) {
    const genre = mapTitleToGenre(title);
    console.log(`  ${title.padEnd(12)} → ${genre || '(null)'}`);
  }
}

function testLocalPartPatterns() {
  printSeparator('LOCAL PART PATTERN DETECTION');

  const localParts = [
    'john.smith',      // firstname.lastname
    'j.smith',         // f.lastname
    'jsmith',          // No clear pattern
    'jSmith',          // camelCase
    'smith.john',      // Could be lastname.firstname
    'john_smith',      // underscore variant
    'info',            // Service
    'admin',           // Service
  ];

  for (const localPart of localParts) {
    const result = detectLocalPartPattern(localPart);
    if (result.pattern) {
      console.log(`  ${localPart.padEnd(15)} → pattern: ${result.pattern}, given: "${result.givenHint}", surname: "${result.surnameHint}"`);
    } else {
      console.log(`  ${localPart.padEnd(15)} → (no pattern detected)`);
    }
  }
}

function testServiceAddressDetection() {
  printSeparator('SERVICE ADDRESS DETECTION');

  const emails = [
    'info@company.com',
    'sales@company.com',
    'support@company.com',
    'admin@company.com',
    'noreply@company.com',
    'vendite@azienda.it',
    'kontakt@firma.de',
    'john.smith@company.com',
    'mario.rossi@azienda.it',
    'hans.mueller@firma.de',
  ];

  for (const email of emails) {
    const isService = isServiceAddress(email);
    console.log(`  ${email.padEnd(30)} → ${isService ? 'SERVICE' : 'PERSONAL'}`);
  }
}

function testStatusClassification() {
  printSeparator('EXTRACTION STATUS CLASSIFICATION');

  const testCases: Array<{ desc: string; result: LLMExtractionResult }> = [
    {
      desc: 'High confidence, both names',
      result: {
        name1: 'John', name2: 'Smith', genre: 'Mr.',
        email: 'john@example.com', domain: 'example.com',
        isPersonal: true, confidence: 0.92,
        extractionStatus: 'extracted_medium', reasoning: 'test',
      },
    },
    {
      desc: 'High confidence, missing surname',
      result: {
        name1: 'John', name2: null, genre: null,
        email: 'john@example.com', domain: 'example.com',
        isPersonal: true, confidence: 0.90,
        extractionStatus: 'extracted_high', reasoning: 'test',
      },
    },
    {
      desc: 'Medium confidence',
      result: {
        name1: 'John', name2: 'Smith', genre: null,
        email: 'john@example.com', domain: 'example.com',
        isPersonal: true, confidence: 0.72,
        extractionStatus: 'extracted_high', reasoning: 'test',
      },
    },
    {
      desc: 'Low confidence',
      result: {
        name1: 'Unknown', name2: null, genre: null,
        email: 'user@example.com', domain: 'example.com',
        isPersonal: true, confidence: 0.45,
        extractionStatus: 'extracted_medium', reasoning: 'test',
      },
    },
    {
      desc: 'Service address',
      result: {
        name1: null, name2: null, genre: null,
        email: 'info@company.com', domain: 'company.com',
        isPersonal: false, confidence: 0.99,
        extractionStatus: 'extracted_high', reasoning: 'test',
      },
    },
  ];

  for (const { desc, result } of testCases) {
    const status = classifyExtractionStatus(result);
    console.log(`  ${desc.padEnd(35)} → ${status}`);
  }
}

// Run all tests
console.log('\n🧪 Email Extraction Pipeline Test Suite');
console.log('Testing preprocessing, validation, and classification on real examples\n');

testPreprocessing();
testValidation();
testTitleMapping();
testLocalPartPatterns();
testServiceAddressDetection();
testStatusClassification();

console.log('\n' + '='.repeat(70));
console.log('✅ All tests completed');
console.log('='.repeat(70) + '\n');
