# Whot Naija Edition - Free Hosting Deployment Guide

This guide will help you deploy the Whot Naija Edition game using free hosting services: Netlify for the frontend and Railway for the backend.

## Prerequisites

1. GitHub account
2. Netlify account (free)
3. Railway account (free tier available)

## Step 1: Prepare Your Repository

Ensure your code is pushed to GitHub. The repository should contain:
- Frontend code (React/Vite)
- Backend code in `backend/` directory
- Configuration files created in this setup

## Step 2: Deploy Backend to Railway

### Option A: Using Railway CLI (Recommended)

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. Initialize Railway project:
   ```bash
   cd backend
   railway init
   railway up
   ```

3. Set environment variables in Railway dashboard:
   - `CORS_ORIGIN`: Set to your Netlify frontend URL (will update after frontend deployment)
   - `NODE_ENV`: `production`
   - `PORT`: `3004` (Railway sets this automatically)

### Option B: Using Railway Dashboard

1. Go to [Railway.app](https://railway.app) and create a new project
2. Connect your GitHub repository
3. Set the root directory to `backend/`
4. Railway will automatically detect the Node.js app
5. Set environment variables as above

### Get Your Backend URL

After deployment, note your Railway backend URL (e.g., `https://your-project.up.railway.app`)

## Step 3: Deploy Frontend to Netlify

### Option A: Using Netlify CLI

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   netlify login
   ```

2. Deploy to Netlify:
   ```bash
   netlify init
   # Follow prompts to connect to your GitHub repo
   netlify build
   netlify deploy --prod
   ```

3. Set environment variable in Netlify dashboard:
   - `VITE_SOCKET_SERVER_URL`: Set to your Railway backend URL

### Option B: Using Netlify Dashboard

1. Go to [Netlify.com](https://netlify.com) and sign up/login
2. Click "New site from Git"
3. Connect your GitHub repository
4. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Add environment variable:
   - `VITE_SOCKET_SERVER_URL`: Your Railway backend URL
6. Click "Deploy site"

### Get Your Frontend URL

After deployment, note your Netlify frontend URL (e.g., `https://amazing-site.netlify.app`)

## Step 4: Update CORS Configuration

1. Go back to your Railway project dashboard
2. Update the `CORS_ORIGIN` environment variable with your Netlify frontend URL
3. Redeploy the backend to apply changes

## Step 5: Test the Deployment

1. Visit your Netlify frontend URL
2. Test multiplayer functionality
3. Check browser console for any connection errors

## Troubleshooting

### Backend Issues
- Check Railway logs for errors
- Ensure environment variables are set correctly
- Verify the `/health` endpoint is accessible

### Frontend Issues
- Check Netlify build logs
- Ensure `VITE_SOCKET_SERVER_URL` is set correctly
- Check browser network tab for connection issues

### CORS Issues
- Ensure `CORS_ORIGIN` in Railway matches your Netlify URL exactly
- Include protocol (https://) and no trailing slash

## Free Tier Limitations

### Railway Free Tier
- 512 MB RAM
- 1 GB disk
- Sleeps after 24 hours of inactivity
- Limited concurrent connections

### Netlify Free Tier
- 100 GB bandwidth/month
- 100 build minutes/month
- No custom domains (can use netlify.app subdomain)

## Cost Optimization

- Railway free tier is sufficient for moderate multiplayer games
- Netlify free tier handles static frontend well
- Monitor usage and upgrade if needed

## Environment Variables Summary

### Backend (Railway)
```
CORS_ORIGIN=https://your-netlify-site.netlify.app
NODE_ENV=production
```

### Frontend (Netlify)
```
VITE_SOCKET_SERVER_URL=https://your-railway-backend.up.railway.app
```

## Support

If you encounter issues:
1. Check the deployment logs
2. Verify environment variables
3. Test locally first
4. Ensure all configuration files are committed to GitHub
