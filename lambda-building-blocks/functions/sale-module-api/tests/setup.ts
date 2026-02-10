/**
 * Test setup and global mocks
 */

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('@aws-sdk/client-lambda');

// Set environment variables for tests
process.env.AWS_REGION = 'eu-west-1';
process.env.SALES_TABLE_NAME = 'test-sales-table';
process.env.BUYERS_TABLE_NAME = 'test-buyers-table';
process.env.PRODUCERS_TABLE_NAME = 'test-producers-table';
process.env.DOCUMENTS_BUCKET_NAME = 'test-documents-bucket';
process.env.TEMPLATE_RENDERER_FUNCTION_NAME = 'test-template-renderer';
process.env.HTML_TO_PDF_FUNCTION_NAME = 'test-html-to-pdf';
process.env.SDI_GENERATOR_FUNCTION_NAME = 'test-sdi-generator';
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(10000);
