const fs = require('fs').promises;
const path = require('path');

class SleepMonitor {
  constructor(googleHealthClient, slackClient) {
    this.googleHealthClient = googleHealthClient;
    this.slackClient = slackClient;
    this.stateFile = path.join(__dirname, '..', 'data', 'last_sleep.json');
    this.lastSleepSession = null;
  }

  /**
   * Initialize the monitor by loading the last known sleep session
   */
  async initialize() {
    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
      
      try {
        const data = await fs.readFile(this.stateFile, 'utf-8');
        this.lastSleepSession = JSON.parse(data);
        console.log('Loaded last sleep session:', this.lastSleepSession);
      } catch (err) {
        // File doesn't exist yet, that's okay
        console.log('No previous sleep session found, starting fresh');
      }
    } catch (error) {
      console.error('Error initializing sleep monitor:', error.message);
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
   * Force check and send notification (for testing)
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
      console.error('Error forcing notification:', error.message);
      return false;
    }
  }
}

module.exports = SleepMonitor;
