# Sleep Slack Notifier 😴 → 📢

A tool that monitors your sleep data from the Google Health API (formerly Fitbit API) and sends a wake-up notification to a Slack channel with the message: "anson just woke up, he slept for X hours X minutes"

## Features

- 🔄 Automatic monitoring of sleep sessions via Google Health API
- 📨 Sends formatted notifications to Slack when you wake up
- 🐳 Fully dockerized for easy deployment
- 🔒 Secure: Uses environment variables for all credentials
- ⏰ Configurable check intervals
- 💾 Persistent state tracking to avoid duplicate notifications
- 🧪 Built-in testing and debugging tools

## Prerequisites

1. **Google Cloud Project** with Health API enabled
2. **Slack Workspace** with bot token
3. **Docker and Docker Compose** (for containerized deployment)
4. **Node.js 20+** (for local development)

## Setup Guide

### 1. Google Health API Setup

#### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Health API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Health API"
   - Click "Enable"

#### Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure the OAuth consent screen:
   - Application name: "Sleep Slack Notifier" (or your choice)
   - User support email: your email
   - Developer contact: your email
   - Add scopes: `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
4. Create OAuth client ID:
   - Application type: **Web application**
   - Name: "Sleep Notifier"
   - Authorized redirect URIs: `http://localhost:3000/oauth2callback` (or your redirect URI)
5. Save your **Client ID** and **Client Secret**

### 2. Slack Setup

#### Create a Slack App

1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App" > "From scratch"
3. Name it "Sleep Notifier" and select your workspace
4. Navigate to "OAuth & Permissions"
5. Add the following **Bot Token Scopes**:
   - `chat:write` - Send messages
   - `chat:write.public` - Send messages to public channels
6. Install the app to your workspace
7. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
8. Invite the bot to your channel:
   ```
   /invite @Sleep Notifier
   ```

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```bash
   # Google Health API
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
   
   # Slack
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_CHANNEL_ID=C082W0UQMLN
   
   # Optional: Adjust check interval (default: every 15 minutes)
   CHECK_INTERVAL=*/15 * * * *
   ```

### 4. Authorize Google Health API

You need to obtain a refresh token by authorizing the application:

#### Option A: Using Docker

```bash
# Start authorization flow
docker compose run --rm sleep-notifier npm start -- --authorize
```

#### Option B: Local Development

```bash
# Install dependencies
npm install

# Start authorization flow
npm start -- --authorize
```

This will output an authorization URL. Follow these steps:

1. **Copy the URL** and open it in your browser
2. **Sign in** with your Google account (linked to Fitbit)
3. **Grant permissions** for sleep data access
4. You'll be redirected to your redirect URI with a `code` parameter
5. **Copy the code** from the URL
6. Add it to your `.env` file:
   ```bash
   GOOGLE_AUTH_CODE=your-authorization-code
   ```
7. **Exchange the code for tokens**:
   ```bash
   npm start -- --exchange-token
   # or with Docker:
   # docker compose run --rm sleep-notifier npm start -- --exchange-token
   ```
8. This will output your **refresh token**. Add it to `.env`:
   ```bash
   GOOGLE_REFRESH_TOKEN=your-refresh-token
   ```
9. Remove `GOOGLE_AUTH_CODE` from `.env` (no longer needed)

### 5. Test Your Setup

```bash
# Test connections
npm start -- --test
# or with Docker:
# docker compose run --rm sleep-notifier npm start -- --test

# Force send a notification with your latest sleep data
npm start -- --force
# or with Docker:
# docker compose run --rm sleep-notifier npm start -- --force
```

### 6. Run the Application

#### Using Docker Compose (Recommended)

```bash
# Build and start the service
docker compose up -d

# View logs
docker compose logs -f

# Stop the service
docker compose down
```

#### Local Development

```bash
# Install dependencies
npm install

# Start monitoring
npm start

# Or with auto-reload on code changes
npm run dev
```

## How It Works

1. **Periodic Checks**: The application runs a cron job (default: every 15 minutes) to check for new sleep sessions
2. **Fetch Sleep Data**: Queries the Google Health API for the most recent sleep session
3. **Detect Wake-Up**: Compares the latest sleep session with the previously recorded one
4. **Send Notification**: If a new wake-up is detected (within the last hour), sends a message to Slack
5. **Persist State**: Saves the sleep session to avoid duplicate notifications

## Command-Line Options

```bash
npm start                    # Start monitoring (default)
npm start -- --authorize     # Get authorization URL
npm start -- --exchange-token # Exchange auth code for refresh token
npm start -- --test          # Test API connections
npm start -- --force         # Force send notification with latest sleep data
```

## Configuration

### Check Interval

Modify `CHECK_INTERVAL` in `.env` using cron syntax:

```bash
# Every 5 minutes
CHECK_INTERVAL=*/5 * * * *

# Every 30 minutes
CHECK_INTERVAL=*/30 * * * *

# Every hour
CHECK_INTERVAL=0 * * * *

# Every 15 minutes (default)
CHECK_INTERVAL=*/15 * * * *
```

### Timezone

Set your timezone in `.env`:

```bash
TIMEZONE=America/New_York
# or
TIMEZONE=Europe/London
# or
TIMEZONE=Asia/Tokyo
```

## Project Structure

```
.
├── src/
│   ├── index.js              # Main entry point
│   ├── googleHealthClient.js # Google Health API client
│   ├── slackClient.js        # Slack API client
│   └── sleepMonitor.js       # Sleep monitoring logic
├── data/                      # Persistent state storage (created at runtime)
├── .env                       # Environment variables (not in git)
├── .env.example               # Example environment file
├── .gitignore                 # Git ignore rules
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile                 # Docker image definition
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## Troubleshooting

### "Missing required environment variables"

Make sure all required variables are set in your `.env` file:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_REFRESH_TOKEN`
- `SLACK_BOT_TOKEN`

### "GOOGLE_REFRESH_TOKEN not set"

You need to complete the authorization flow:
1. Run `npm start -- --authorize`
2. Follow the authorization URL
3. Get the auth code and add to `.env`
4. Run `npm start -- --exchange-token`

### "Slack connection failed"

- Verify your `SLACK_BOT_TOKEN` is correct
- Ensure the bot has been invited to the channel
- Check that the bot has `chat:write` permissions

### "No sleep data found"

- Make sure you have sleep data in your Fitbit/Google Health account
- Verify your Fitbit device synced recently
- Try running `npm start -- --force` to see if data is available

### "401 Unauthorized" from Google Health API

- Your refresh token may have expired (they expire after 6 months of inactivity)
- Re-run the authorization flow to get a new refresh token

## Security Considerations

- ✅ Never commit `.env` file to version control
- ✅ Use environment variables for all secrets
- ✅ Run Docker container as non-root user
- ✅ Keep dependencies updated: `npm audit fix`
- ✅ Rotate tokens periodically
- ✅ Use HTTPS for redirect URIs in production

## Development

```bash
# Install dependencies
npm install

# Run with auto-reload
npm run dev

# Test connections
npm start -- --test

# Force notification (for testing)
npm start -- --force
```

## Docker Commands

```bash
# Build image
docker compose build

# Start service
docker compose up -d

# View logs
docker compose logs -f sleep-notifier

# Restart service
docker compose restart

# Stop service
docker compose down

# Remove volumes (resets state)
docker compose down -v
```

## API Rate Limits

- **Google Health API**: Generally no strict rate limits for personal use
- **Slack API**: Tier 3 - 50+ requests per minute

The default check interval (15 minutes) is well within these limits.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the logs: `docker compose logs -f`
3. Test individual components: `npm start -- --test`
4. Open an issue on GitHub with details and error messages
stuff i host very messy yes
