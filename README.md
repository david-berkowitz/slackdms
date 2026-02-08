# Community Ops Console (Slack App)

Track active community members (messages + reactions in the last 90 days), run outreach workflows, and send DMs from authorized admin accounts.

## What Is Included

- Slack OAuth install flow and event ingestion
- Supabase schema for workspaces, users, activity, senders, workflows, and DM jobs
- Admin UI for activity filters, DM campaigns, workflow automation, and backfill
- Queue processor endpoint for safe, batched message sending

## Local Setup

1. Open Terminal.
2. Change into your project folder:

```bash
cd /Users/davidberkowitz/Documents/SlackDMs
```

3. Copy environment variables file:

```bash
cp .env.example .env.local
```

4. Fill in `.env.local` values:
- `NEXT_PUBLIC_BASE_URL`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `SLACK_REDIRECT_URI`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

5. Apply the SQL in `/Users/davidberkowitz/Documents/SlackDMs/supabase/schema.sql` in Supabase SQL Editor.

6. Configure your Slack app:
- OAuth redirect URL: `http://localhost:3000/api/slack/callback`
- Event request URL: `http://localhost:3000/api/slack/events`
- Event subscriptions:
  - `message.channels`
  - `reaction_added`
  - `team_join`
  - `member_joined_channel`
- Reinstall the app after scope changes.

7. Start locally:

```bash
npm run dev
```

8. Open admin UI:
- `http://localhost:3000/admin`

## Key Endpoints

- `GET /api/slack/install` start Slack OAuth
- `GET /api/slack/callback` store tokens and sender account
- `POST /api/slack/events` ingest Slack events
- `POST /api/slack/sync-users` pull users into Supabase
- `POST /api/slack/sync-channels` pull channels and join public channels
- `GET /api/workspaces` list connected workspaces (team ID helper)
- `GET /api/channels` list channels for workflow targeting
- `GET /api/active` list active users
- `POST /api/dm-jobs` create DM campaign
- `POST /api/dm-jobs/run` process one DM job chunk
- `POST /api/dm-jobs/process-queue` process multiple queued DM jobs
- `GET /api/cron/dm-queue` secure endpoint for scheduled queue processing
- `GET /api/senders` list authorized sender accounts
- `GET/POST/PUT /api/workflows` workflow CRUD
- `POST /api/workflows/backfill` backfill welcome workflow for recent joins

## Deploy MVP (Netlify)

1. Open Terminal.
2. Change to project folder:

```bash
cd /Users/davidberkowitz/Documents/SlackDMs
```

3. Push this repo to GitHub.
4. In Netlify, create a new site from that GitHub repo.
5. Build settings:
- Build command: `npm run build`
- Publish directory: leave blank (Netlify + Next plugin handles this)

6. Add environment variables in Netlify:
- `NEXT_PUBLIC_BASE_URL` = your live Netlify URL (example: `https://your-site.netlify.app`)
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `SLACK_REDIRECT_URI` = `https://your-site.netlify.app/api/slack/callback`
- `SLACK_BOT_SCOPES`
- `SLACK_USER_SCOPES`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

7. Update Slack app URLs to production:
- OAuth redirect URL: `https://YOUR_DOMAIN/api/slack/callback`
- Event request URL: `https://YOUR_DOMAIN/api/slack/events`

8. Reinstall Slack app in each workspace.
9. In admin UI:
- Click `Find connected workspaces`
- Select team
- Sync users
- Sync channels
- Create workflow
- Run backfill

## Optional Scheduled Queue Processing

Use any scheduler (for example cron-job.org) to call:
- `GET https://YOUR_DOMAIN/api/cron/dm-queue?secret=YOUR_CRON_SECRET`

Recommended schedule: every 2 to 5 minutes.
