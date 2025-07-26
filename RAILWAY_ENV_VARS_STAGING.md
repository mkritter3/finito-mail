# Railway Staging Environment Variables Checklist

Copy these environment variables to your Railway staging environment:

## Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://aaouupausotsxnlvpzjg.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhb3V1cGF1c290c3hubHZwempnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzY1MzMsImV4cCI6MjA2ODkxMjUzM30.ygctN2V0dMPWHjH3vdWoX9mLzIpscH4ziBLanH5cYKY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhb3V1cGF1c290c3hubHZwempnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzY1MzMsImV4cCI6MjA2ODkxMjUzM30.ygctN2V0dMPWHjH3vdWoX9mLzIpscH4ziBLanH5cYKY`

## Google OAuth
- [ ] `GOOGLE_CLIENT_ID` = `91764869362-94akqo7h8dlmnujesjab6fofhh8cls9o.apps.googleusercontent.com`
- [ ] `GOOGLE_CLIENT_SECRET` = `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`
- [ ] `GOOGLE_REDIRECT_URI` = `https://finito-mail-staging.up.railway.app/auth/callback`

## Redis (Railway internal)
- [ ] `REDIS_URL` = `redis://default:gLWvFffxqeWuCyCwUyzimNqrqJguAXEl@redis.railway.internal:6379`

## Gmail Pub/Sub
- [ ] `GMAIL_PUBSUB_TOPIC` = `projects/finito-mail-staging/topics/gmail-push-notifications`
- [ ] `PUBSUB_VERIFICATION_TOKEN` = Generate a secure random token

## App Configuration
- [ ] `NEXT_PUBLIC_APP_URL` = `https://finito-mail-staging.up.railway.app`
- [ ] `NODE_ENV` = `production`
- [ ] `E2E_TESTING` = `false`

## Optional (for production readiness)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` = Your Sentry DSN if you have one
- [ ] `SENTRY_DSN` = Your Sentry DSN if you have one
- [ ] `SENTRY_ENVIRONMENT` = `staging`
- [ ] `HEALTH_CHECK_API_KEY` = Generate a secure random key

## Notes:
1. The Redis URL uses Railway's internal networking (redis.railway.internal)
2. Make sure to update the Google OAuth redirect URI in Google Cloud Console to match the staging URL
3. Generate secure random tokens for PUBSUB_VERIFICATION_TOKEN and HEALTH_CHECK_API_KEY