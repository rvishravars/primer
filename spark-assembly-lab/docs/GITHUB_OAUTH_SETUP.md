# GitHub OAuth Setup Guide

This guide explains how to set up GitHub OAuth authentication for the Spark Assembly Lab.

## Overview

The Spark Assembly Lab uses GitHub OAuth to allow users to log in with their GitHub account. The login flow is:

1. User clicks "Login" button
2. Browser redirects to GitHub's authorization page
3. User authorizes the application
4. GitHub redirects back to the app with an authorization code
5. Backend exchanges the code for an access token
6. User is logged in and can see their username and avatar

## Prerequisites

- A GitHub account
- A GitHub OAuth App registered (see setup below)

## Setting Up a GitHub OAuth App

### Option 1: Personal GitHub OAuth App (Recommended for local development)

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name**: `Spark Assembly Lab` (or any name)
   - **Homepage URL**: `http://localhost:3000` (for local development)
   - **Authorization callback URL**: `http://localhost:3000/auth/callback`
4. Click "Register application"
5. Copy the **Client ID** and **Client Secret**

### Option 2: Organization OAuth App (For production/team use)

Follow the same steps, but:
- Use your organization's homepage URL
- Use your production callback URL (e.g., `https://sparks.primer.community/auth/callback`)

## Configuration

### Local Development (Docker)

1. Create an `.env` file in the `spark-assembly-lab` directory:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback
```

2. Update `docker-compose.yml` to pass these as environment variables:

```yaml
environment:
  - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
  - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
  - GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback
```

3. Reload your Docker container:

```bash
docker compose up --build
```

### Production Deployment

1. Set the following environment variables in your deployment:

```bash
GITHUB_CLIENT_ID=your_production_client_id
GITHUB_CLIENT_SECRET=your_production_client_secret
GITHUB_REDIRECT_URI=https://your-domain.com/auth/callback
```

2. Update your GitHub OAuth App with the production callback URL:
   - Go to the OAuth App settings
   - Update "Authorization callback URL" to your production domain

## Security Considerations

- **Never commit `.env` files** - they contain secrets
- **Keep Client Secret private** - treat it like a password
- **Use HTTPS in production** - OAuth redirects require HTTPS
- **Token storage** - Access tokens are stored in localStorage for browser persistence
- **Token scope** - The app requests `user:email` and `read:user` scopes for profile access

## Troubleshooting

### "OAuth is not properly configured on the server"

- Check that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set
- Verify you restarted the server after setting environment variables

### "GitHub redirect URI mismatch"

- Ensure the callback URL in your GitHub OAuth App settings matches exactly
- Check for trailing slashes or protocol mismatches

### "Authorization failed: access_denied"

- User clicked "Cancel" on GitHub's authorization page
- This is normal and just means they chose not to authorize

### Login button doesn't appear

- Check browser console for errors
- Verify the backend is running on port 8080
- Check `/api/auth/login-url` endpoint in the Network tab

## API Endpoints

### `/api/auth/login-url` (GET)

Returns the GitHub OAuth authorization URL.

**Response:**
```json
{
  "url": "https://github.com/login/oauth/authorize?..."
}
```

### `/api/auth/callback` (POST)

Exchanges authorization code for access token.

**Request body:**
```json
{
  "code": "authorization_code_from_github"
}
```

**Response:**
```json
{
  "authenticated": true,
  "token": "access_token",
  "user": {
    "login": "username",
    "avatar_url": "https://...",
    "name": "Full Name",
    "id": 12345
  }
}
```

### `/api/auth/status` (GET)

Checks if current token is valid.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "authenticated": true,
  "user": { ... }
}
```

## Further Reading

- [GitHub OAuth Documentation](https://docs.github.com/en/apps/oauth-apps)
- [Creating an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-an-oauth-app/creating-an-oauth-app)
