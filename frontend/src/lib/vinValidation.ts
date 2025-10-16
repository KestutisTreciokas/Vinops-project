/**
 * VIN validation utilities
 *
 * Standard VIN format: 11-17 alphanumeric characters
 * Excludes: I, O, Q (to avoid confusion with 1 and 0)
 */

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{11,17}$/

/**
 * Normalize VIN input by removing non-alphanumeric characters and converting to uppercase
 */
export function normalizeVin(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * Validate VIN format
 * Returns true if VIN is 11-17 characters, uppercase alphanumeric, excluding I/O/Q
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

  if (normalized.length < 11) {
    return lang === 'ru'
      ? `VIN слишком короткий (${normalized.length} символов, минимум 11)`
      : `VIN too short (${normalized.length} characters, minimum 11)`
  }

  if (normalized.length > 17) {
    return lang === 'ru'
      ? `VIN слишком длинный (${normalized.length} символов, максимум 17)`
      : `VIN too long (${normalized.length} characters, maximum 17)`
  }

  // Check for invalid characters (I, O, Q, or non-alphanumeric)
  const invalidChars = normalized.match(/[IOQ]/g)
  if (invalidChars) {
    return lang === 'ru'
      ? `VIN содержит недопустимые символы: ${invalidChars.join(', ')} (I, O, Q не используются в VIN)`
      : `VIN contains invalid characters: ${invalidChars.join(', ')} (I, O, Q are not used in VINs)`
  }

  return lang === 'ru'
    ? 'Недопустимый формат VIN'
    : 'Invalid VIN format'
}
