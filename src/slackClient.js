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
