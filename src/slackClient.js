const { WebClient } = require('@slack/web-api');

class SlackClient {
  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.channelId = process.env.SLACK_CHANNEL_ID || 'C082W0UQMLN';
  }

  /**
   * Send a wake-up notification to the Slack channel
   */
  async sendWakeUpNotification(sleepData) {
    try {
      const message = this.formatWakeUpMessage(sleepData);
      
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        text: message,
        blocks: this.createMessageBlocks(sleepData)
      });

      console.log(`Message sent successfully to ${this.channelId}`);
      return result;
    } catch (error) {
      console.error('Error sending Slack message:', error.message);
      throw error;
    }
  }

  /**
   * Format the wake-up message
   */
  formatWakeUpMessage(sleepData) {
    const { hours, minutes } = sleepData;
    return `anson just woke up, he slept for ${hours} hours ${minutes} minutes`;
  }

  /**
   * Create rich message blocks for better formatting
   */
  createMessageBlocks(sleepData) {
    const { hours, minutes, startTime, endTime } = sleepData;
    
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*anson just woke up* :sunrise:`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sleep Duration:*\n${hours} hours ${minutes} minutes`
          },
          {
            type: 'mrkdwn',
            text: `*Woke Up:*\n${endTime.toLocaleTimeString()}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Slept from ${startTime.toLocaleString()} to ${endTime.toLocaleString()}`
          }
        ]
      }
    ];
  }

  /**
   * Send a workout summary notification to the Slack channel
   */
  async sendWorkoutSummary(workoutData) {
    try {
      const text = this.formatWorkoutMessage(workoutData);

      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        text,
        blocks: this.createWorkoutBlocks(workoutData)
      });

      console.log(`Workout summary sent to ${this.channelId}`);
      return result;
    } catch (error) {
      console.error('Error sending workout Slack message:', error.message);
      throw error;
    }
  }

  /**
   * Format the workout fallback text
   */
  formatWorkoutMessage(workoutData) {
    const { activityType, durationMinutes, calories, distanceKm } = workoutData;
    const name = this.formatActivityName(activityType);
    let msg = `anson just finished a ${name} (${durationMinutes} min)`;
    if (calories) msg += `, burned ${calories} cal`;
    if (distanceKm) msg += `, ${distanceKm} km`;
    return msg;
  }

  /**
   * Convert API activity type enum to a readable name
   */
  formatActivityName(activityType) {
    const map = {
      WALK: 'Walk', RUN: 'Run', SPORT_CYCLING: 'Bike', SWIM: 'Swim',
      HIKING: 'Hike', YOGA: 'Yoga', STRENGTH_TRAINING: 'Strength Training',
      ELLIPTICAL: 'Elliptical', PILATES: 'Pilates', DANCE: 'Dance',
      MARTIAL_ARTS: 'Martial Arts', SPORT: 'Sport', UNKNOWN: 'Workout'
    };
    return map[activityType] || activityType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Create rich Slack blocks for workout summary
   */
  createWorkoutBlocks(workoutData) {
    const { activityType, durationMinutes, calories, distanceKm, steps, avgHeartRate, startTime, endTime } = workoutData;
    const name = this.formatActivityName(activityType);

    const fields = [
      { type: 'mrkdwn', text: `*Activity:*\n${name}` },
      { type: 'mrkdwn', text: `*Duration:*\n${durationMinutes} min` }
    ];

    if (calories) fields.push({ type: 'mrkdwn', text: `*Calories:*\n${calories} kcal` });
    if (distanceKm) fields.push({ type: 'mrkdwn', text: `*Distance:*\n${distanceKm} km` });
    if (steps) fields.push({ type: 'mrkdwn', text: `*Steps:*\n${steps.toLocaleString()}` });
    if (avgHeartRate) fields.push({ type: 'mrkdwn', text: `*Avg HR:*\n${avgHeartRate} bpm` });

    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*anson just finished a workout* :muscle:` }
      },
      {
        type: 'section',
        fields
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `${startTime.toLocaleString()} → ${endTime.toLocaleString()}` }
        ]
      }
    ];
  }

  /**
   * Test the Slack connection
   */
  async testConnection() {
    try {
      const result = await this.client.auth.test();
      console.log('Slack connection successful!');
      console.log('Bot name:', result.user);
      console.log('Team:', result.team);
      return result;
    } catch (error) {
      console.error('Slack connection failed:', error.message);
      throw error;
    }
  }
}

module.exports = SlackClient;
