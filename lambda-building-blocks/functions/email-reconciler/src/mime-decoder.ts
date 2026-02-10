/**
 * RFC 2047 MIME Encoded-Word Decoder
 * Handles =?charset?encoding?text?= format in email headers
 */

/**
 * Decode a MIME encoded word (RFC 2047)
 * Supports Q (quoted-printable) and B (base64) encodings
 *
 * @param input - Raw input string that may contain MIME encoded words
 * @returns Decoded string
 */
export function decodeMimeWord(input: string): string {
  if (!input) {
    return '';
  }

  // Pattern matches: =?charset?encoding?text?=
  // With optional whitespace between consecutive encoded words
  const mimePattern = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

  let result = input;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let decoded = '';

  // Reset regex state
  mimePattern.lastIndex = 0;

  while ((match = mimePattern.exec(input)) !== null) {
    // Add any text before this encoded word
    if (match.index > lastIndex) {
      const between = input.slice(lastIndex, match.index);
      // RFC 2047: whitespace between encoded words should be ignored
      if (!/^\s+$/.test(between)) {
        decoded += between;
      }
    }

    const [fullMatch, charset, encoding, encodedText] = match;
    const decodedWord = decodeEncodedWord(charset, encoding.toUpperCase(), encodedText);
    decoded += decodedWord;

    lastIndex = match.index + fullMatch.length;
  }

  // Add any remaining text after the last encoded word
  if (lastIndex < input.length) {
    decoded += input.slice(lastIndex);
  }

  // If no encoded words were found, return original
  if (lastIndex === 0) {
    return input;
  }

  return decoded;
}

/**
 * Decode a single encoded word
 */
function decodeEncodedWord(charset: string, encoding: string, text: string): string {
  try {
    let bytes: Uint8Array;

    if (encoding === 'B') {
      // Base64 decoding
      bytes = base64Decode(text);
    } else if (encoding === 'Q') {
      // Quoted-printable decoding
      bytes = quotedPrintableDecode(text);
    } else {
      // Unknown encoding, return as-is
      return text;
    }

    // Decode bytes to string using the specified charset
    return decodeCharset(bytes, charset);
  } catch (error) {
    // On any error, return the original text
    console.warn(`Failed to decode MIME word: ${error}`);
    return text;
  }
}

/**
 * Decode base64 encoded string to bytes
 */
function base64Decode(text: string): Uint8Array {
  // Handle URL-safe base64 variants
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode quoted-printable encoded string to bytes
 * RFC 2047 variant: underscores represent spaces
 */
function quotedPrintableDecode(text: string): Uint8Array {
  const bytes: number[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === '_') {
      // In RFC 2047 Q encoding, _ represents space
      bytes.push(0x20);
      i++;
    } else if (char === '=' && i + 2 < text.length) {
      // Hex-encoded byte
      const hex = text.slice(i + 1, i + 3);
      const byte = parseInt(hex, 16);
      if (!isNaN(byte)) {
        bytes.push(byte);
        i += 3;
      } else {
        // Invalid hex, treat as literal
        bytes.push(char.charCodeAt(0));
        i++;
      }
    } else {
      bytes.push(char.charCodeAt(0));
      i++;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Decode bytes to string using specified charset
 */
function decodeCharset(bytes: Uint8Array, charset: string): string {
  const normalizedCharset = charset.toLowerCase().replace(/[_-]/g, '');

  // Use TextDecoder for supported charsets
  const charsetMap: Record<string, string> = {
    'utf8': 'utf-8',
    'utf16': 'utf-16',
    'utf16le': 'utf-16le',
    'utf16be': 'utf-16be',
    'iso88591': 'iso-8859-1',
    'iso88592': 'iso-8859-2',
    'iso88593': 'iso-8859-3',
    'iso88594': 'iso-8859-4',
    'iso88595': 'iso-8859-5',
    'iso88596': 'iso-8859-6',
    'iso88597': 'iso-8859-7',
    'iso88598': 'iso-8859-8',
    'iso88599': 'iso-8859-9',
    'iso885910': 'iso-8859-10',
    'iso885913': 'iso-8859-13',
    'iso885914': 'iso-8859-14',
    'iso885915': 'iso-8859-15',
    'iso885916': 'iso-8859-16',
    'latin1': 'iso-8859-1',
    'latin2': 'iso-8859-2',
    'windows1250': 'windows-1250',
    'windows1251': 'windows-1251',
    'windows1252': 'windows-1252',
    'windows1253': 'windows-1253',
    'windows1254': 'windows-1254',
    'windows1255': 'windows-1255',
    'windows1256': 'windows-1256',
    'windows1257': 'windows-1257',
    'windows1258': 'windows-1258',
    'cp1250': 'windows-1250',
    'cp1251': 'windows-1251',
    'cp1252': 'windows-1252',
    'koi8r': 'koi8-r',
    'koi8u': 'koi8-u',
    'gb2312': 'gb2312',
    'gbk': 'gbk',
    'gb18030': 'gb18030',
    'big5': 'big5',
    'eucjp': 'euc-jp',
    'euckr': 'euc-kr',
    'shiftjis': 'shift-jis',
    'sjis': 'shift-jis',
  };

  const decoderCharset = charsetMap[normalizedCharset] || charset;

  try {
    const decoder = new TextDecoder(decoderCharset);
    return decoder.decode(bytes);
  } catch (error) {
    // Fallback: try UTF-8, then Latin-1
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      // Last resort: treat as Latin-1 (single-byte charset)
      return Array.from(bytes)
        .map(b => String.fromCharCode(b))
        .join('');
    }
  }
}

/**
 * Check if a string contains MIME encoded words
 */
export function containsMimeEncoding(input: string): boolean {
  return /=\?[^?]+\?[BbQq]\?[^?]*\?=/.test(input);
}

/**
 * Fully decode a string that may contain multiple MIME encoded segments
 * Also handles nested/malformed encodings gracefully
 */
export function fullyDecodeMime(input: string): string {
  if (!input) {
    return '';
  }

  let result = input;
  let previousResult = '';
  let iterations = 0;
  const maxIterations = 5; // Prevent infinite loops

  // Keep decoding until no more changes or max iterations reached
  while (result !== previousResult && iterations < maxIterations) {
    previousResult = result;
    result = decodeMimeWord(result);
    iterations++;
  }

  return result;
}

/**
 * Clean up common encoding artifacts
 * - Remove replacement characters (U+FFFD)
 * - Normalize whitespace
 */
export function cleanDecodedText(input: string): string {
  if (!input) {
    return '';
  }

  return input
    // Remove replacement characters
    .replace(/\uFFFD/g, '')
    // Replace multiple question marks (common artifact of failed decoding)
    .replace(/\?{3,}/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
