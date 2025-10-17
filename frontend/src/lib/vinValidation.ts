/**
 * VIN validation utilities
 *
 * Supports multiple VIN formats:
 * - Standard 17-character VIN (excludes I, O, Q)
 * - EU CIN: 14 characters with hyphen (e.g., XX-XXX12345A999)
 * - US HIN: 12 characters (e.g., XXX12345A999)
 * - Legacy VIN: 5-13 characters (pre-1981)
 */

const VIN_REGEX = /^(?:(?=[A-HJ-NPR-Z0-9]{17}$)[A-HJ-NPR-Z0-9]{17}|[A-Z]{2}-[A-HJ-NPR-Z2-9]{3}[A-HJ-NPR-Z0-9]{5}[A-L][0-9][0-9]{2}|[A-Z]{3}[A-HJ-NPR-Z0-9]{5}[A-L][0-9][0-9]{2}|[A-HJ-NPR-Z0-9]{5,13})$/

/**
 * Normalize VIN input by removing whitespace, converting to uppercase
 * Preserves hyphens for EU CIN format
 */
export function normalizeVin(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

/**
 * Validate VIN format
 * Supports: 17-char VIN, EU CIN (with hyphen), US HIN (12-char), Legacy VIN (5-13 chars)
 */
export function isValidVin(vin: string): boolean {
  return VIN_REGEX.test(vin)
}

/**
 * Get validation error message for invalid VIN
 */
export function getVinErrorMessage(vin: string, lang: 'en' | 'ru'): string {
  const normalized = normalizeVin(vin)

  if (normalized.length === 0) {
    return lang === 'ru' ? 'VIN не может быть пустым' : 'VIN cannot be empty'
  }

  if (normalized.length < 5) {
    return lang === 'ru'
      ? `VIN слишком короткий (${normalized.length} символов, минимум 5)`
      : `VIN too short (${normalized.length} characters, minimum 5)`
  }

  // More permissive length check for multiple VIN formats
  if (normalized.length > 17 && !normalized.includes('-')) {
    return lang === 'ru'
      ? `VIN слишком длинный (${normalized.length} символов, максимум 17)`
      : `VIN too long (${normalized.length} characters, maximum 17)`
  }

  // Check for invalid characters (I, O, Q in most positions)
  const invalidChars = normalized.match(/[IOQ]/g)
  if (invalidChars) {
    return lang === 'ru'
      ? `VIN содержит недопустимые символы: ${invalidChars.join(', ')} (I, O, Q обычно не используются в VIN)`
      : `VIN contains invalid characters: ${invalidChars.join(', ')} (I, O, Q are typically not used in VINs)`
  }

  return lang === 'ru'
    ? 'Недопустимый формат VIN (поддерживаются: стандартный 17-символьный VIN, EU CIN, US HIN, legacy VIN)'
    : 'Invalid VIN format (supported: 17-char VIN, EU CIN, US HIN, legacy VIN)'
}
