# 🚀 Supabase Google OAuth Configuration Guide

## Step 1: Access Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project (the one with URL: `https://aaouupausotsxnlvpzjg.supabase.co`)

## Step 2: Navigate to Authentication Settings

1. In the left sidebar, click **Authentication**
2. Click on **Providers** tab

## Step 3: Configure Google Provider

1. Find **Google** in the list of providers
2. Click to expand the Google section
3. Toggle **Enable Google provider** to ON

## Step 4: Add Your Google OAuth Credentials

Fill in these fields:

- **Google client ID**: 
  ```
  YOUR_GOOGLE_CLIENT_ID_HERE
  ```

- **Google client secret**: 
  ```
  YOUR_GOOGLE_CLIENT_SECRET_HERE
  ```

- **Authorized Client IDs** (optional): Leave empty for now

## Step 5: Copy the Redirect URL

After enabling Google, Supabase will show you a **Redirect URL** that looks like:
```
https://aaouupausotsxnlvpzjg.supabase.co/auth/v1/callback
```

**IMPORTANT**: Copy this URL - you'll need it for the next step!

## Step 6: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. You'll need to update ALL OAuth clients that will use Supabase:

### For Development Client:
1. Click on your **Development OAuth 2.0 Client ID**
2. In **Authorized redirect URIs**, click **+ ADD URI**
3. Add BOTH:
   - Your existing localhost callback: `http://localhost:3001/api/auth/callback`
   - The Supabase redirect URL: `https://aaouupausotsxnlvpzjg.supabase.co/auth/v1/callback`
4. Click **SAVE**

### For Production Client:
1. Click on your **Production OAuth 2.0 Client ID** 
2. In **Authorized redirect URIs**, click **+ ADD URI**
3. Add the Supabase redirect URL: `https://aaouupausotsxnlvpzjg.supabase.co/auth/v1/callback`
4. Click **SAVE**

**Note**: You can have multiple redirect URIs per OAuth client. This allows the same client to work with both your old manual flow (if needed) and the new Supabase flow.

## Step 7: Configure Scopes (Optional but Recommended)

Back in Supabase dashboard, under the Google provider settings:

1. Find **Additional Scopes** field
2. Add these Gmail-specific scopes:
   ```
   https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send
   ```

## Step 8: Save Configuration

1. Scroll down and click **Save** in the Supabase dashboard

## Step 9: Test the Configuration

1. Clear your browser storage: http://localhost:3001/clear-auth.html
2. Go to http://localhost:3001/auth
3. Click "Continue with Google"
4. You should be redirected to Google's consent screen
5. After approving, you'll be redirected back to your app

## 🎯 What Happens Behind the Scenes

When configured properly:

1. User clicks "Continue with Google"
2. Supabase redirects to Google with your client ID
3. User approves permissions
4. Google redirects to Supabase's callback URL
5. Supabase:
   - Creates/updates the user in auth.users
   - Stores Google tokens
   - Creates a Supabase session
6. Your app receives the session with Gmail access tokens

## 🔍 Troubleshooting

### "Redirect URI mismatch" error
- Make sure the Supabase redirect URL is EXACTLY copied to Google Console
- Check for trailing slashes or protocol differences (http vs https)

### "Invalid client" error
- Double-check your Client ID and Secret in Supabase
- Ensure the OAuth client in Google Console is not disabled

### No provider_token in session
- Make sure you're requesting the Gmail scopes
- Check that `access_type: 'offline'` is set in your code

## 📝 Important Notes

- **Same Supabase URL for Dev & Prod**: Your Supabase instance handles both development and production authentication with the same redirect URL
- **Multiple OAuth Clients**: If you have separate OAuth clients for dev/staging/prod in Google Console, add the Supabase redirect URL to each one
- **Keep Existing URLs**: Don't remove your existing redirect URIs - just add the Supabase one
- **Provider tokens**: Only available server-side for security
- **Token expiration**: Access tokens expire after 1 hour - plan for refresh logic later

## 🔐 Security Best Practice

For production, consider:
1. Creating a separate Supabase project for production
2. Using environment-specific OAuth clients in Google
3. Restricting redirect URIs to only what's needed

This way your dev and prod environments are completely isolated.

That's it! Your Google OAuth should now work seamlessly with Supabase.