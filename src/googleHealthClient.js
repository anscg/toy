const { OAuth2Client } = require('google-auth-library');

class GoogleHealthClient {
  constructor() {
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials if refresh token is available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
    }
  }

  /**
   * Get the authorization URL for initial setup
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
      'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly'
    ];

    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code) {
    const { tokens } = await this.client.getToken(code);
    this.client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Get the most recent sleep session.
   * Uses the list endpoint with a filter on civil_end_time as per Google Health API docs:
   * GET /v4/users/me/dataTypes/sleep/dataPoints?filter=sleep.interval.civil_end_time >= "YYYY-MM-DD"
   */
  async getLatestSleepSession() {
    try {
      // Look back 2 days to catch the most recent sleep
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 2);
      const dateStr = lookback.toISOString().split('T')[0]; // YYYY-MM-DD

      const url = 'https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints';
      const params = new URLSearchParams({
        filter: `sleep.interval.civil_end_time >= "${dateStr}"`
      });

      const response = await this.client.request({
        url: `${url}?${params}`,
        method: 'GET'
      });

      const dataPoints = response.data.dataPoints;
      if (!dataPoints || dataPoints.length === 0) {
        return null;
      }

      // Sort by end time descending to get the most recent sleep session
      const sorted = dataPoints.sort((a, b) => {
        return new Date(b.sleep.interval.endTime) - new Date(a.sleep.interval.endTime);
      });

      return this.parseSleepSession(sorted[0]);
    } catch (error) {
      console.error('Error fetching sleep data:', error.message);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  /**
   * Parse a sleep dataPoint from the Google Health API response.
   * Response shape: { sleep: { interval: { startTime, endTime }, summary: { minutesAsleep } } }
   */
  parseSleepSession(dataPoint) {
    const sleep = dataPoint.sleep;
    const startTime = new Date(sleep.interval.startTime);
    const endTime = new Date(sleep.interval.endTime);

    // Prefer the API-provided minutesAsleep; fall back to wall-clock duration
    const totalMinutes = sleep.summary?.minutesAsleep
      ? parseInt(sleep.summary.minutesAsleep, 10)
      : Math.floor((endTime - startTime) / (1000 * 60));

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
      startTime,
      endTime,
      hours,
      minutes,
      isMainSleep: sleep.metadata?.main || false
    };
  }

  /**
   * Test API connection by fetching recent sleep data.
   * GET /v4/users/me/dataTypes/sleep/dataPoints?filter=sleep.interval.civil_end_time >= "YYYY-MM-DD"
   */
  async testConnection() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const url = 'https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints';
      const params = new URLSearchParams({
        filter: `sleep.interval.civil_end_time >= "${dateStr}"`
      });

      const response = await this.client.request({
        url: `${url}?${params}`,
        method: 'GET'
      });

      const count = response.data.dataPoints?.length ?? 0;
      return { success: true, message: `Connected. Found ${count} sleep session(s) since ${dateStr}.` };
    } catch (error) {
      console.error('Error testing Google Health API connection:', error.message);
      throw error;
    }
  }

  /**
   * Get the most recent completed workout session.
   * GET /v4/users/me/dataTypes/exercise/dataPoints?filter=exercise.interval.civil_end_time >= "YYYY-MM-DD"
   * Requires scope: activity_and_fitness.readonly
   */
  async getLatestWorkout() {
    try {
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 2);
      const dateStr = lookback.toISOString().split('T')[0];

      const url = 'https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints';
      const params = new URLSearchParams({
        filter: `exercise.interval.civil_end_time >= "${dateStr}"`
      });

      const response = await this.client.request({
        url: `${url}?${params}`,
        method: 'GET'
      });

      const dataPoints = response.data.dataPoints;
      if (!dataPoints || dataPoints.length === 0) {
        return null;
      }

      // Sort by end time descending to get the most recent workout
      const sorted = dataPoints.sort((a, b) =>
        new Date(b.exercise.interval.endTime) - new Date(a.exercise.interval.endTime)
      );

      return this.parseWorkoutSession(sorted[0]);
    } catch (error) {
      console.error('Error fetching exercise data:', error.message);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  /**
   * Parse an exercise dataPoint from the Google Health API response.
   * Docs: exercise.exerciseType (enum), exercise.displayName (string),
   *       exercise.activeDuration (e.g. "3600s"), exercise.metricsSummary.*
   */
  parseWorkoutSession(dataPoint) {
    const ex = dataPoint.exercise;
    const startTime = new Date(ex.interval.startTime);
    const endTime = new Date(ex.interval.endTime);

    // activeDuration is a proto Duration string like "3661s" — prefer it over wall clock
    const durationMinutes = ex.activeDuration
      ? Math.round(parseInt(ex.activeDuration, 10) / 60)
      : Math.round((endTime - startTime) / (1000 * 60));

    // displayName is the human-readable label; fall back to exerciseType enum
    const activityType = ex.displayName || ex.exerciseType || 'UNKNOWN';

    // metricsSummary fields — all optional depending on activity type
    const m = ex.metricsSummary || {};
    const calories = m.caloriesKcal != null ? Math.round(m.caloriesKcal) : null;
    // distanceMillimeters → km
    const distanceKm = m.distanceMillimeters != null
      ? (m.distanceMillimeters / 1_000_000).toFixed(2)
      : null;
    const steps = m.steps != null ? parseInt(m.steps, 10) : null;
    const avgHeartRate = m.averageHeartRateBeatsPerMinute != null
      ? parseInt(m.averageHeartRateBeatsPerMinute, 10)
      : null;

    return {
      startTime,
      endTime,
      durationMinutes,
      activityType,
      calories,
      distanceKm,
      steps,
      avgHeartRate
    };
  }
}

module.exports = GoogleHealthClient;
