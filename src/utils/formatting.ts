/**
 * General Formatting Utilities
 */

/**
 * Format a date to localized string
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, options || {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date to time string
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format distance with appropriate units
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters} m`;
}

/**
 * Format ordinal numbers (1st, 2nd, 3rd, etc.)
 */
export function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format athlete name (First L.)
 */
export function formatAthleteName(name: string, abbreviated: boolean = false): string {
  if (!abbreviated) return name;

  const parts = name.trim().split(' ');
  if (parts.length === 1) return name;

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}.`;
}

/**
 * Pluralize a word based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const p = plural || `${singular}s`;
  return count === 1 ? singular : p;
}

/**
 * Format a count with label (e.g., "3 results", "1 athlete")
 */
export function formatCount(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Generate a session name based on date and parameters
 */
export function generateSessionName(distance?: number, location?: string): string {
  const datePart = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const parts = [datePart];

  if (distance) {
    parts.push(`${distance}m`);
  }

  if (location) {
    parts.push(location);
  }

  return parts.join(' - ');
}

/**
 * Format confidence percentage
 */
export function formatConfidence(confidence: number | null): string {
  if (confidence === null) return 'N/A';
  return `${Math.round(confidence)}%`;
}

/**
 * Get confidence level label
 */
export function getConfidenceLevel(confidence: number | null): 'high' | 'medium' | 'low' | 'unknown' {
  if (confidence === null) return 'unknown';
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}
