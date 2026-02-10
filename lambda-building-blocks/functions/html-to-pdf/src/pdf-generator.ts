import puppeteer, { PDFOptions, Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { logger } from './logger';

export interface PdfOptions {
  format?: 'A4' | 'A3' | 'Letter' | 'Legal';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
  landscape?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  scale?: number;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
}

let browserInstance: Browser | null = null;

/**
 * Get or create a reusable browser instance
 * Reusing the browser instance improves performance for subsequent calls
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    logger.info('Reusing existing browser instance');
    return browserInstance;
  }

  logger.info('Launching new browser instance');

  // Configure Chromium for Lambda environment
  const executablePath = await chromium.executablePath();

  browserInstance = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  logger.info('Browser launched successfully');
  return browserInstance;
}

/**
 * Generate PDF from HTML content
 */
export async function generatePDF(
  html: string,
  options?: PdfOptions
): Promise<Buffer> {
  const startTime = Date.now();
  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    logger.info('Setting page content', { htmlLength: html.length });

    // Set page content with proper encoding
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'load'],
      timeout: 30000
    });

    logger.info('Generating PDF');

    // Build Puppeteer PDF options
    const pdfOptions: PDFOptions = {
      format: options?.format || 'A4',
      printBackground: options?.printBackground !== false, // Default true
      landscape: options?.landscape || false,
      displayHeaderFooter: options?.displayHeaderFooter || false,
      margin: {
        top: options?.margin?.top || '10mm',
        right: options?.margin?.right || '10mm',
        bottom: options?.margin?.bottom || '10mm',
        left: options?.margin?.left || '10mm',
      },
      preferCSSPageSize: options?.preferCSSPageSize || false,
    };

    // Add optional parameters
    if (options?.headerTemplate) {
      pdfOptions.headerTemplate = options.headerTemplate;
    }
    if (options?.footerTemplate) {
      pdfOptions.footerTemplate = options.footerTemplate;
    }
    if (options?.scale) {
      pdfOptions.scale = options.scale;
    }
    if (options?.pageRanges) {
      pdfOptions.pageRanges = options.pageRanges;
    }

    const pdfBuffer = await page.pdf(pdfOptions);

    const duration = Date.now() - startTime;
    logger.info('PDF generated successfully', {
      duration,
      size: pdfBuffer.length,
      format: pdfOptions.format
    });

    return pdfBuffer;

  } catch (error: any) {
    logger.error('PDF generation error', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Failed to generate PDF: ${error.message}`);
  } finally {
    // Clean up page
    if (page) {
      try {
        await page.close();
      } catch (e) {
        logger.warn('Failed to close page', { error: e });
      }
    }
  }
}

/**
 * Close browser instance (call during Lambda shutdown if needed)
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close();
      browserInstance = null;
      logger.info('Browser closed');
    } catch (error) {
      logger.error('Error closing browser', { error });
    }
  }
}
