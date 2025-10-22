/**
 * Timezone Utilities
 * Handles timezone detection and conversion for meetings
 */

/**
 * Get the user's local timezone
 * @returns {string} IANA timezone name (e.g., "America/New_York")
 */
export function getUserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a date/time in the user's local timezone
 * @param {string|Date} dateTime - ISO date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date/time
 */
export function formatInLocalTimezone(dateTime, options = {}) {
  const {
    includeTimezone = false,
    dateStyle = 'medium',
    timeStyle = 'short',
    showRelative = false
  } = options;

  // Database stores times without timezone info (timestamp without timezone)
  // We need to add 'Z' suffix to treat them as UTC
  let dateString = dateTime;
  if (typeof dateTime === 'string' && !dateTime.endsWith('Z') && !dateTime.includes('+') && !dateTime.includes('-', 10)) {
    dateString = `${dateTime}Z`;
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  // Show relative time (Today, Tomorrow, etc.)
  if (showRelative) {
    const relative = getRelativeDay(date);
    if (relative) {
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${relative} at ${timeStr}`;
    }
  }

  // Format with date and time
  const formatter = new Intl.DateTimeFormat('en-US', {
    dateStyle,
    timeStyle,
    timeZone: getUserTimezone()
  });

  let formatted = formatter.format(date);

  // Add timezone abbreviation if requested
  if (includeTimezone) {
    const tzName = date.toLocaleTimeString('en-US', {
      timeZoneName: 'short',
      timeZone: getUserTimezone()
    }).split(' ').pop();
    formatted += ` ${tzName}`;
  }

  return formatted;
}

/**
 * Get relative day name (Today, Tomorrow, Yesterday)
 * @param {Date} date - Date to check
 * @returns {string|null} Relative day name or null
 */
function getRelativeDay(date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  
  return null;
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean}
 */
function isSameDay(date1, date2) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Format date range for a meeting
 * @param {string|Date} startTime - Start time
 * @param {string|Date} endTime - End time
 * @param {Object} options - Formatting options
 * @returns {string} Formatted range
 */
export function formatMeetingTimeRange(startTime, endTime, options = {}) {
  // Add 'Z' suffix if missing (database times are UTC)
  let startString = startTime;
  if (typeof startTime === 'string' && !startTime.endsWith('Z') && !startTime.includes('+') && !startTime.includes('-', 10)) {
    startString = `${startTime}Z`;
  }
  let endString = endTime;
  if (typeof endTime === 'string' && !endTime.endsWith('Z') && !endTime.includes('+') && !endTime.includes('-', 10)) {
    endString = `${endTime}Z`;
  }
  
  const start = typeof startString === 'string' ? new Date(startString) : startString;
  const end = typeof endString === 'string' ? new Date(endString) : endString;

  const { includeTimezone = false, showRelative = true } = options;

  // Show relative date with time range
  if (showRelative) {
    const relative = getRelativeDay(start);
    if (relative) {
      const startTimeStr = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const endTimeStr = end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      let result = `${relative}, ${startTimeStr} - ${endTimeStr}`;
      
      if (includeTimezone) {
        const tzName = start.toLocaleTimeString('en-US', {
          timeZoneName: 'short',
          timeZone: getUserTimezone()
        }).split(' ').pop();
        result += ` ${tzName}`;
      }
      
      return result;
    }
  }

  // Full date with time range
  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  const startTimeStr = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  const endTimeStr = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  let result = `${dateStr}, ${startTimeStr} - ${endTimeStr}`;
  
  if (includeTimezone) {
    const tzName = start.toLocaleTimeString('en-US', {
      timeZoneName: 'short',
      timeZone: getUserTimezone()
    }).split(' ').pop();
    result += ` ${tzName}`;
  }
  
  return result;
}

/**
 * Get timezone offset string (e.g., "UTC-5")
 * @param {Date} date - Date to get offset for
 * @returns {string} Offset string
 */
export function getTimezoneOffset(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  
  return `UTC${sign}${hours}${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}`;
}

/**
 * Convert UTC time to local time string
 * @param {string} utcTime - UTC time string
 * @returns {string} Local time string
 */
export function utcToLocal(utcTime) {
  const date = new Date(utcTime);
  return formatInLocalTimezone(date, { showRelative: true, includeTimezone: true });
}

/**
 * Get meeting duration in minutes
 * @param {string|Date} startTime - Start time
 * @param {string|Date} endTime - End time
 * @returns {number} Duration in minutes
 */
export function getMeetingDuration(startTime, endTime) {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Format duration as human-readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration
 */
export function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `${hours} hr`;
  }
  
  return `${hours} hr ${mins} min`;
}

