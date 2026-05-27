require('dotenv').config();
const cron = require('node-cron');
const GoogleHealthClient = require('./googleHealthClient');
const SlackClient = require('./slackClient');
const SleepMonitor = require('./sleepMonitor');

// Validate environment variables
function validateEnv() {
  const required = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'SLACK_BOT_TOKEN'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    console.error('\nPlease check your .env file');
    process.exit(1);
  }

  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    console.warn('⚠️  GOOGLE_REFRESH_TOKEN not set. You need to authorize the app first.');
    console.warn('   Run: npm start -- --authorize');
  }
}

// Handle OAuth authorization flow
async function handleAuthorization() {
  const googleHealthClient = new GoogleHealthClient();
  
  console.log('\n🔐 Google Health API Authorization\n');
  console.log('Visit this URL to authorize the application:');
  console.log('\n' + googleHealthClient.getAuthUrl() + '\n');
  console.log('After authorizing, you will be redirected to your redirect URI with a code parameter.');
  console.log('Copy the code and set it as GOOGLE_AUTH_CODE in your .env file, then run:');
  console.log('  npm start -- --exchange-token\n');
}

// Exchange authorization code for tokens
async function exchangeToken() {
  if (!process.env.GOOGLE_AUTH_CODE) {
    console.error('❌ GOOGLE_AUTH_CODE not found in .env file');
    process.exit(1);
  }

  const googleHealthClient = new GoogleHealthClient();
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    const tokens = await googleHealthClient.getTokens(process.env.GOOGLE_AUTH_CODE);
    
    console.log('\n✅ Success! Add these to your .env file:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token}\n`);
    console.log('You can remove GOOGLE_AUTH_CODE from your .env file now.');
  } catch (error) {
    console.error('❌ Error exchanging token:', error.message);
    process.exit(1);
  }
}

// Test connections
async function testConnections() {
  console.log('🧪 Testing connections...\n');
  
  const googleHealthClient = new GoogleHealthClient();
  const slackClient = new SlackClient();
  
  try {
    console.log('Testing Slack connection...');
    await slackClient.testConnection();
    console.log('✅ Slack connection successful\n');
  } catch (error) {
    console.error('❌ Slack connection failed:', error.message);
  }
  
  try {
    console.log('Testing Google Health API connection...');
    const result = await googleHealthClient.testConnection();
    console.log('✅ Google Health API connection successful');
    console.log('  ', result.message);
  } catch (error) {
    console.error('❌ Google Health API connection failed:', error.message);
  }
}

// Force send a notification with current sleep data
async function forceNotification() {
  console.log('🔔 Forcing notification with latest sleep data...\n');

  const googleHealthClient = new GoogleHealthClient();
  const slackClient = new SlackClient();
  const sleepMonitor = new SleepMonitor(googleHealthClient, slackClient);

  await sleepMonitor.initialize();
  const success = await sleepMonitor.forceNotification();

  if (success) {
    console.log('\n✅ Notification sent successfully!');
  } else {
    console.log('\n❌ Failed to send notification');
  }
}

// Force send a workout summary with current workout data
async function forceWorkoutNotification() {
  console.log('🏋️  Forcing workout summary with latest workout data...\n');

  const googleHealthClient = new GoogleHealthClient();
  const slackClient = new SlackClient();
  const sleepMonitor = new SleepMonitor(googleHealthClient, slackClient);

  await sleepMonitor.initialize();
  const success = await sleepMonitor.forceWorkoutNotification();

  if (success) {
    console.log('\n✅ Workout summary sent successfully!');
  } else {
    console.log('\n❌ Failed to send workout summary');
  }
}

// Main monitoring loop
async function startMonitoring() {
  console.log('🚀 Starting Sleep Monitor...\n');
  
  validateEnv();
  
  const googleHealthClient = new GoogleHealthClient();
  const slackClient = new SlackClient();
  const sleepMonitor = new SleepMonitor(googleHealthClient, slackClient);
  
  await sleepMonitor.initialize();
  
  // Run checks immediately on startup
  console.log('Running initial checks...');
  await sleepMonitor.checkForWakeUp();
  await sleepMonitor.checkForWorkout();

  // Schedule checks every 15 minutes
  const schedule = process.env.CHECK_INTERVAL || '*/15 * * * *';
  console.log(`\n⏰ Scheduled checks: ${schedule}`);
  console.log('   (Default: every 15 minutes)\n');

  cron.schedule(schedule, async () => {
    console.log(`\n--- Check at ${new Date().toLocaleString()} ---`);
    await sleepMonitor.checkForWakeUp();
    await sleepMonitor.checkForWorkout();
  });
  
  console.log('✅ Sleep monitor is running! Press Ctrl+C to stop.\n');
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--authorize')) {
    await handleAuthorization();
  } else if (args.includes('--exchange-token')) {
    await exchangeToken();
  } else if (args.includes('--test')) {
    validateEnv();
    await testConnections();
  } else if (args.includes('--force')) {
    validateEnv();
    await forceNotification();
  } else if (args.includes('--force-workout')) {
    validateEnv();
    await forceWorkoutNotification();
  } else {
    await startMonitoring();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Start the application
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
