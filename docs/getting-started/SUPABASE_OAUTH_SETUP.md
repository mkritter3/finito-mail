# Supabase Google OAuth Setup Guide

## Problem
You're getting "user_creation_failed" because we're trying to manually handle OAuth instead of using Supabase's built-in OAuth system.

## Solution: Use Supabase Auth (Much Simpler!)

### 1. Configure Google OAuth in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and click to expand
4. Enable Google provider
5. Add your Google OAuth credentials:
   - **Client ID**: `YOUR_GOOGLE_CLIENT_ID`
   - **Client Secret**: `YOUR_GOOGLE_CLIENT_SECRET`
6. Copy the **Redirect URL** shown (it will be something like `https://aaouupausotsxnlvpzjg.supabase.co/auth/v1/callback`)

### 2. Update Google Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to your OAuth 2.0 Client
3. Add the Supabase redirect URL from step 1.6 to **Authorized redirect URIs**

### 3. Use the Native Supabase Flow

The key insight is that Supabase handles EVERYTHING for you:
- User creation
- Token management  
- Session handling
- Token refresh

You don't need:
- Service keys for auth (only use anon key)
- Manual user creation
- Manual token exchange
- Complex callback handling

### 4. The Simple Implementation

```typescript
// Login: Just use Supabase's built-in OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly'
  }
})

// Callback: Supabase handles everything
const { data, error } = await supabase.auth.exchangeCodeForSession(code)

// Get Gmail access token when needed
const session = await supabase.auth.getSession()
const gmailAccessToken = session.data.session?.provider_token
```

That's it! No manual user creation, no service keys needed for auth.