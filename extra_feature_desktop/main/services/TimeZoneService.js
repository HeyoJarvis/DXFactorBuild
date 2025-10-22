/**
 * TimeZone Service
 * 
 * Handles timezone conversions and working hours detection for teams
 */

class TimeZoneService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    
    // Define working hours (9am - 5pm)
    this.workingHoursStart = options.workingHoursStart || 9;
    this.workingHoursEnd = options.workingHoursEnd || 17;
    
    // Define extended availability (7am - 8pm)
    this.availableHoursStart = options.availableHoursStart || 7;
    this.availableHoursEnd = options.availableHoursEnd || 20;
    
    this.logger.info?.('TimeZone Service initialized');
  }

  /**
   * Convert UTC date to team's local time
   * @param {Date|string} utcDate - UTC date/time
   * @param {string} teamTimezone - IANA timezone (e.g., 'America/New_York')
   * @returns {Date} Local date in team's timezone
   */
  convertToTeamTime(utcDate, teamTimezone) {
    try {
      const date = new Date(utcDate);
      
      // Get the time string in the target timezone
      const localTimeString = date.toLocaleString('en-US', {
        timeZone: teamTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      return new Date(localTimeString);
    } catch (error) {
      this.logger.error?.('Failed to convert timezone', {
        error: error.message,
        timezone: teamTimezone
      });
      return new Date(utcDate);
    }
  }

  /**
   * Check if team is currently in working hours
   * @param {string} teamTimezone - IANA timezone
   * @returns {boolean} True if currently in working hours (9am-5pm)
   */
  isWorkingHours(teamTimezone) {
    try {
      const now = new Date();
      const hour = this.getCurrentHour(teamTimezone);
      
      return hour >= this.workingHoursStart && hour < this.workingHoursEnd;
    } catch (error) {
      this.logger.error?.('Failed to check working hours', {
        error: error.message,
        timezone: teamTimezone
      });
      return false;
    }
  }

  /**
   * Get current hour in team's timezone
   * @param {string} teamTimezone - IANA timezone
   * @returns {number} Hour (0-23)
   */
  getCurrentHour(teamTimezone) {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
      timeZone: teamTimezone,
      hour: 'numeric',
      hour12: false
    });
    
    return parseInt(timeString);
  }

  /**
   * Get working hours status for team
   * @param {string} teamTimezone - IANA timezone
   * @returns {string} Status: 'working', 'available', or 'offline'
   */
  getWorkingHoursStatus(teamTimezone) {
    try {
      const hour = this.getCurrentHour(teamTimezone);
      
      // Working hours (9am - 5pm)
      if (hour >= this.workingHoursStart && hour < this.workingHoursEnd) {
        return 'working';
      }
      
      // Extended availability (7am - 8pm)
      if (hour >= this.availableHoursStart && hour < this.availableHoursEnd) {
        return 'available';
      }
      
      // Offline (night time)
      return 'offline';
    } catch (error) {
      this.logger.error?.('Failed to get working hours status', {
        error: error.message,
        timezone: teamTimezone
      });
      return 'unknown';
    }
  }

  /**
   * Format date/time for team's timezone
   * @param {Date|string} utcDate - UTC date/time
   * @param {string} teamTimezone - IANA timezone
   * @param {Object} options - Formatting options
   * @returns {string} Formatted date/time string
   */
  formatTimeForTeam(utcDate, teamTimezone, options = {}) {
    try {
      const date = new Date(utcDate);
      
      const formatOptions = {
        timeZone: teamTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        ...options
      };
      
      return date.toLocaleString('en-US', formatOptions);
    } catch (error) {
      this.logger.error?.('Failed to format time', {
        error: error.message,
        timezone: teamTimezone
      });
      return new Date(utcDate).toLocaleString();
    }
  }

  /**
   * Get current time in team's timezone
   * @param {string} teamTimezone - IANA timezone
   * @returns {string} Current time formatted (e.g., "3:45 PM")
   */
  getCurrentTimeForTeam(teamTimezone) {
    return this.formatTimeForTeam(new Date(), teamTimezone, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      year: undefined,
      month: undefined,
      day: undefined
    });
  }

  /**
   * Get timezone abbreviation (e.g., EST, PST)
   * @param {string} teamTimezone - IANA timezone
   * @returns {string} Timezone abbreviation
   */
  getTimezoneAbbreviation(teamTimezone) {
    try {
      const now = new Date();
      const formatted = now.toLocaleString('en-US', {
        timeZone: teamTimezone,
        timeZoneName: 'short'
      });
      
      // Extract timezone abbreviation (last part)
      const parts = formatted.split(' ');
      return parts[parts.length - 1];
    } catch (error) {
      this.logger.error?.('Failed to get timezone abbreviation', {
        error: error.message,
        timezone: teamTimezone
      });
      return teamTimezone;
    }
  }

  /**
   * Calculate time difference between two timezones
   * @param {string} timezone1 - First IANA timezone
   * @param {string} timezone2 - Second IANA timezone
   * @returns {number} Hour difference
   */
  getTimezoneDifference(timezone1, timezone2) {
    try {
      const now = new Date();
      
      const hour1 = this.getCurrentHour(timezone1);
      const hour2 = this.getCurrentHour(timezone2);
      
      let diff = hour1 - hour2;
      
      // Adjust for day boundary
      if (diff > 12) diff -= 24;
      if (diff < -12) diff += 24;
      
      return diff;
    } catch (error) {
      this.logger.error?.('Failed to calculate timezone difference', {
        error: error.message,
        timezone1,
        timezone2
      });
      return 0;
    }
  }

  /**
   * Get relative time with timezone context
   * @param {Date|string} pastDate - Past date/time
   * @param {string} teamTimezone - Team's timezone
   * @returns {string} Relative time string (e.g., "2 hours ago (in their timezone)")
   */
  getRelativeTime(pastDate, teamTimezone) {
    try {
      const now = new Date();
      const past = new Date(pastDate);
      const diffMs = now - past;
      
      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      let relativeTime;
      
      if (seconds < 60) {
        relativeTime = 'just now';
      } else if (minutes < 60) {
        relativeTime = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (hours < 24) {
        relativeTime = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else if (days < 7) {
        relativeTime = `${days} day${days > 1 ? 's' : ''} ago`;
      } else {
        // For older dates, show formatted date
        return this.formatTimeForTeam(pastDate, teamTimezone, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      return `${relativeTime} (their time)`;
    } catch (error) {
      this.logger.error?.('Failed to get relative time', {
        error: error.message,
        timezone: teamTimezone
      });
      return 'recently';
    }
  }

  /**
   * List of common timezones for UI selection
   * @returns {Array} Array of timezone objects with label and value
   */
  static getCommonTimezones() {
    return [
      { label: 'Pacific Time (US)', value: 'America/Los_Angeles' },
      { label: 'Mountain Time (US)', value: 'America/Denver' },
      { label: 'Central Time (US)', value: 'America/Chicago' },
      { label: 'Eastern Time (US)', value: 'America/New_York' },
      { label: 'UK Time', value: 'Europe/London' },
      { label: 'Central European Time', value: 'Europe/Paris' },
      { label: 'Eastern European Time', value: 'Europe/Bucharest' },
      { label: 'India Standard Time', value: 'Asia/Kolkata' },
      { label: 'China Standard Time', value: 'Asia/Shanghai' },
      { label: 'Japan Standard Time', value: 'Asia/Tokyo' },
      { label: 'Australia Eastern Time', value: 'Australia/Sydney' },
      { label: 'New Zealand Time', value: 'Pacific/Auckland' },
      { label: 'UTC', value: 'UTC' }
    ];
  }
}

module.exports = TimeZoneService;

