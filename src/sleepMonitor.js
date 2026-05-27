const fs = require('fs').promises;
const path = require('path');

class SleepMonitor {
  constructor(googleHealthClient, slackClient) {
    this.googleHealthClient = googleHealthClient;
    this.slackClient = slackClient;
    this.stateFile = path.join(__dirname, '..', 'data', 'last_sleep.json');
    this.workoutStateFile = path.join(__dirname, '..', 'data', 'last_workout.json');
    this.dailySummaryStateFile = path.join(__dirname, '..', 'data', 'last_daily_summary.json');
    this.lastSleepSession = null;
    this.lastWorkoutSession = null;
    this.lastDailySummaryDate = null;
  }

  /**
   * Initialize the monitor by loading the last known sleep and workout sessions
   */
  async initialize() {
    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });

      try {
        const data = await fs.readFile(this.stateFile, 'utf-8');
        this.lastSleepSession = JSON.parse(data);
        console.log('Loaded last sleep session:', this.lastSleepSession);
      } catch (err) {
        console.log('No previous sleep session found, starting fresh');
      }

      try {
        const data = await fs.readFile(this.workoutStateFile, 'utf-8');
        this.lastWorkoutSession = JSON.parse(data);
        console.log('Loaded last workout session:', this.lastWorkoutSession);
      } catch (err) {
        console.log('No previous workout session found, starting fresh');
      }
      try {
        const data = await fs.readFile(this.dailySummaryStateFile, 'utf-8');
        this.lastDailySummaryDate = JSON.parse(data).date;
        console.log('Loaded last daily summary date:', this.lastDailySummaryDate);
      } catch (err) {
        console.log('No previous daily summary found, starting fresh');
      }
    } catch (error) {
      console.error('Error initializing monitor:', error.message);
    }
  }

  /**
   * Check for wake-up events
   */
  async checkForWakeUp() {
    try {
      console.log('Checking for wake-up event...');
      
      const latestSleep = await this.googleHealthClient.getLatestSleepSession();
      
      if (!latestSleep) {
        console.log('No sleep data found');
        return false;
      }

      // Check if this is a new sleep session (different end time)
      const isNewSession = !this.lastSleepSession || 
        new Date(latestSleep.endTime).getTime() !== new Date(this.lastSleepSession.endTime).getTime();

      if (isNewSession) {
        console.log('New sleep session detected!');
        console.log(`Slept for ${latestSleep.hours} hours ${latestSleep.minutes} minutes`);

        // Check if the wake-up was recent (within the last hour)
        const timeSinceWakeUp = Date.now() - new Date(latestSleep.endTime).getTime();
        const oneHour = 60 * 60 * 1000;

        if (timeSinceWakeUp <= oneHour) {
          // Send wake-up notification
          await this.slackClient.sendWakeUpNotification(latestSleep);
          
          // Save this sleep session
          await this.saveLastSleepSession(latestSleep);
          
          return true;
        } else {
          console.log('Wake-up was not recent (more than 1 hour ago), skipping notification');
          // Still save it to prevent duplicate notifications
          await this.saveLastSleepSession(latestSleep);
        }
      } else {
        console.log('No new sleep session detected');
      }

      return false;
    } catch (error) {
      console.error('Error checking for wake-up:', error.message);
      return false;
    }
  }

  /**
   * Save the last sleep session to disk
   */
  async saveLastSleepSession(sleepData) {
    try {
      const data = JSON.stringify(sleepData, null, 2);
      await fs.writeFile(this.stateFile, data, 'utf-8');
      this.lastSleepSession = sleepData;
      console.log('Saved sleep session to disk');
    } catch (error) {
      console.error('Error saving sleep session:', error.message);
    }
  }

  /**
   * Check for new completed workouts and send a summary if found
   */
  async checkForWorkout() {
    try {
      console.log('Checking for workout...');

      const latestWorkout = await this.googleHealthClient.getLatestWorkout();

      if (!latestWorkout) {
        console.log('No workout data found');
        return false;
      }

      const isNew = !this.lastWorkoutSession ||
        new Date(latestWorkout.endTime).getTime() !== new Date(this.lastWorkoutSession.endTime).getTime();

      if (isNew) {
        console.log(`New workout detected: ${latestWorkout.activityType} (${latestWorkout.durationMinutes} min)`);

        // Only notify if workout ended within the last hour
        const timeSinceEnd = Date.now() - new Date(latestWorkout.endTime).getTime();
        const oneHour = 60 * 60 * 1000;

        if (timeSinceEnd <= oneHour) {
          await this.slackClient.sendWorkoutSummary(latestWorkout);
          await this.saveLastWorkoutSession(latestWorkout);
          return true;
        } else {
          console.log('Workout was not recent (more than 1 hour ago), skipping notification');
          await this.saveLastWorkoutSession(latestWorkout);
        }
      } else {
        console.log('No new workout detected');
      }

      return false;
    } catch (error) {
      console.error('Error checking for workout:', error.message);
      return false;
    }
  }

  /**
   * Save the last workout session to disk
   */
  async saveLastWorkoutSession(workoutData) {
    try {
      await fs.writeFile(this.workoutStateFile, JSON.stringify(workoutData, null, 2), 'utf-8');
      this.lastWorkoutSession = workoutData;
      console.log('Saved workout session to disk');
    } catch (error) {
      console.error('Error saving workout session:', error.message);
    }
  }

  /**
   * Force send sleep notification (for testing)
   */
  async forceNotification() {
    try {
      const latestSleep = await this.googleHealthClient.getLatestSleepSession();

      if (!latestSleep) {
        console.log('No sleep data found');
        return false;
      }

      console.log('Forcing notification for latest sleep session...');
      await this.slackClient.sendWakeUpNotification(latestSleep);
      await this.saveLastSleepSession(latestSleep);

      return true;
    } catch (error) {
      console.error('Error forcing sleep notification:', error.message);
      return false;
    }
  }

  /**
   * Force send workout notification (for testing)
   */
  async forceWorkoutNotification() {
    try {
      const latestWorkout = await this.googleHealthClient.getLatestWorkout();

      if (!latestWorkout) {
        console.log('No workout data found');
        return false;
      }

      console.log('Forcing notification for latest workout...');
      await this.slackClient.sendWorkoutSummary(latestWorkout);
      await this.saveLastWorkoutSession(latestWorkout);

      return true;
    } catch (error) {
      console.error('Error forcing workout notification:', error.message);
      return false;
    }
  }
  /**
   * Check if a daily summary should be sent (once per calendar day)
   * @param {Date} [date] - override the date (defaults to now in local TZ)
   */
  async checkDailySummary(date = new Date()) {
    try {
      console.log('Checking daily summary...');

      // Use YYYY-MM-DD in the configured timezone
      const tz = process.env.TIMEZONE || 'UTC';
      const todayStr = date.toLocaleDateString('en-CA', { timeZone: tz }); // en-CA = YYYY-MM-DD

      if (this.lastDailySummaryDate === todayStr) {
        console.log(`Daily summary already sent for ${todayStr}`);
        return false;
      }

      const summary = await this.googleHealthClient.getDailySummary(date);

      if (!summary || (summary.steps == null && summary.distanceKm == null && summary.calories == null)) {
        console.log('No daily activity data available yet');
        return false;
      }

      await this.slackClient.sendDailySummary(summary);
      await this.saveLastDailySummaryDate(todayStr);

      return true;
    } catch (error) {
      console.error('Error checking daily summary:', error.message);
      return false;
    }
  }

  async saveLastDailySummaryDate(dateStr) {
    try {
      await fs.writeFile(this.dailySummaryStateFile, JSON.stringify({ date: dateStr }, null, 2), 'utf-8');
      this.lastDailySummaryDate = dateStr;
      console.log('Saved daily summary date to disk');
    } catch (error) {
      console.error('Error saving daily summary date:', error.message);
    }
  }

  /**
   * Force send a daily summary (for testing)
   */
  async forceDailySummary() {
    try {
      const summary = await this.googleHealthClient.getDailySummary(new Date());

      if (!summary) {
        console.log('No daily activity data found');
        return false;
      }

      console.log('Forcing daily summary notification...');
      await this.slackClient.sendDailySummary(summary);
      return true;
    } catch (error) {
      console.error('Error forcing daily summary:', error.message);
      return false;
    }
  }
}

module.exports = SleepMonitor;
