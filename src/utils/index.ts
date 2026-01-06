// Re-export timing utils (exclude duplicated velocity functions)
export {
  formatTime,
  formatTimeCompact,
  parseTime,
  calculatePace,
  formatPace,
  interpolateCrossingTime,
  calculateConfidence,
  getTimingPrecision,
  timesMatch,
} from './timing';

// Re-export formatting utils (exclude duplicated formatDistance)
export {
  formatCount,
  formatConfidence,
  getConfidenceLevel,
  formatDate,
  formatDateTime,
  formatOrdinal,
  formatAthleteName,
  pluralize,
  truncate,
  generateSessionName,
} from './formatting';

// Re-export all velocity utils (these are the canonical implementations)
export * from './velocity';
