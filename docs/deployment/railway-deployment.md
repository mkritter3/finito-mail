# 🚀 Production Deployment Guide

## Railway Deployment Configuration

### 1. Environment Variables

Add these variables in Railway's "Variables" tab:

| Variable Name           | Description                                                                                                                              | Example / How to get                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`              | Sets the environment to production. Next.js and other libraries use this to enable optimizations.                                          | `production`                                                                                                     |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL                                                                                                             | `https://your-project.supabase.co`                                                                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key (safe for client-side)                                                                               | Get from Supabase Dashboard → Settings → API                                                                   |
| `SUPABASE_SERVICE_KEY`  | Your Supabase service role key (server-side only)                                                                                       | Get from Supabase Dashboard → Settings → API                                                                   |
| `NEXTAUTH_SECRET`       | A secret key used to sign and encrypt JWTs and session cookies.                                                                          | Generate a strong, random string. You can use `openssl rand -base64 32` in your terminal.                      |
| `GMAIL_PUBSUB_TOPIC`    | Google Pub/Sub topic for Gmail real-time notifications                                                                                   | `projects/your-project/topics/gmail-notifications`                                                              |
| `PUBSUB_VERIFICATION_TOKEN` | Token to verify Pub/Sub webhooks                                                                                                     | Generate a secure random string                                                                                  |
| `LOG_LEVEL`             | Sets the logging level for production monitoring.                                                                                        | `info` (recommended for production)                                                                               |

### 2. Production Deployment Checklist

**☐ Step 1: Configure Authentication for Production**

**A. Set up Supabase Project:**
1. Create a production Supabase project at [supabase.com](https://supabase.com)
2. In Supabase Dashboard → Authentication → Providers:
   - Enable Google provider
   - Add your Google OAuth credentials (from step B)
   - Copy the redirect URL provided by Supabase

**B. Configure Google Cloud OAuth:**
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a production OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs":
   - The Supabase redirect URL from step A
   - Your Railway app URL: `https://<your-project-name>.up.railway.app/auth/callback`

**☐ Step 2: Set Up Your Railway Project**
1. Log in to your Railway account.
2. Create a new project and link it to your application's GitHub repository.
3. In your project dashboard, go to the "Variables" tab.
4. Add all the environment variables from the table above. Use the "Secret" type for sensitive values like `NEXTAUTH_SECRET` and Google credentials.

**☐ Step 3: Deploy**
1. Commit the optimized `railway.toml` and the new `src/app/api/health/route.ts` file to your repository.
2. Push the changes to your main branch (or whichever branch you've configured Railway to deploy from).
3. Railway will automatically trigger a new deployment. The build process will:
   - Install dependencies across the monorepo
   - Build only the web app and its dependencies using Turbo
   - Start the Next.js server with proper port binding
   - Begin health checks within 20 seconds
4. Monitor the build and deploy logs in the Railway dashboard for any errors.

**☐ Step 4: Post-Deployment Verification**
1. Once the deployment is live, access your Railway URL.
2. Test the authentication flow via Supabase OAuth. The first login might be slow as the container starts up.
3. Check the application logs in Railway for any runtime errors after you log in and interact with the app.
4. Verify that the server actions (e.g., fetching emails) are working correctly.

### 3. Security Considerations

- **Authentication**: Handled by Supabase Auth with secure session management
- **Rate Limiting**: Circuit breaker pattern implemented for Gmail API protection
- **Input Validation**: All Server Actions use Zod for input validation
- **Logging**: Structured logging with Pino for production monitoring
- **Error Handling**: Comprehensive error handling with proper error boundaries

### 4. Monitoring & Debugging

- **Health Check**: `/api/health` endpoint for Railway monitoring
- **Structured Logs**: View logs in Railway dashboard for debugging
- **Error Tracking**: All errors are logged with context and stack traces
- **Performance Metrics**: Circuit breaker metrics available for monitoring

### 5. Scaling Considerations

- **Concurrency Control**: Gmail API requests are limited to 3 concurrent requests
- **Rate Limiting**: 10 requests per second to respect Gmail API limits
- **Circuit Breaker**: Automatic protection against API failures
- **Caching**: Ready for Redis integration for session storage

### 6. Environment-Specific Configuration

**Development**:
- Pretty-printed logs for debugging
- Detailed error messages
- Hot reload enabled

**Production**:
- Structured JSON logs for aggregation
- Sanitized error messages
- Optimized builds
- Performance monitoring enabled

### 7. Alternative: Docker Deployment

If you need more control over the deployment environment, a `Dockerfile` is available in the repository. To use it:

1. Enable Next.js standalone output in `next.config.mjs`
2. Remove `builder` and `buildCommand` from `railway.toml`
3. Railway will automatically detect and use the Dockerfile

### 8. Custom Domain Setup

Once deployed, you can add a custom domain in Railway:

1. Go to your project's "Settings" tab
2. Click "Custom Domains"
3. Add your domain and configure DNS records
4. Update `NEXTAUTH_URL` to use your custom domain

### 9. Troubleshooting

**Common Issues**:
- **OAuth Redirect Mismatch**: Ensure `NEXTAUTH_URL` matches your Railway URL
- **API Failures**: Check circuit breaker logs and Gmail API quotas
- **Build Failures**: Verify all dependencies are in `package.json`
- **Runtime Errors**: Check Railway logs for detailed error messages

**Health Check Failures**:
- Verify the health endpoint is accessible
- Check server startup logs
- Ensure proper environment variables are set

**Performance Issues**:
- Monitor circuit breaker metrics
- Check Gmail API rate limits
- Review structured logs for bottlenecks