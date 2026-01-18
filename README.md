<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1tv5GEAbU1MhfqT0j-6X63yjHqNPDtBwa

## Run Locally

**Prerequisites:** Node.js

### Single Player Mode (Default)
1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

### Multiplayer Mode
1. Install frontend dependencies:
   `npm install`

2. Install backend dependencies:
   `cd backend && npm install`

3. Start the multiplayer server:
   `cd backend && npm start`

4. In another terminal, start the frontend:
   `npm run dev`

5. Open multiple browser tabs/windows to test multiplayer functionality

## Environment Variables

Create a `.env` file in the root directory:

```
VITE_SOCKET_SERVER_URL=http://localhost:3004
```

For production deployment, update `VITE_SOCKET_SERVER_URL` to your deployed backend URL (e.g., `https://your-backend.onrender.com`).

Also, set `CORS_ORIGIN` in the backend environment to your frontend URL.

## Local Development

- Frontend runs on port 3000: `npm run dev`
- Backend runs on port 3004: `cd backend && npm start`

## Deployment to Render

### Architecture Overview

Your Whot card game requires two separate Render services: a Web Service for the backend and a Static Site for the frontend.

### Using Render Blueprint (Recommended)

1. **Create a Blueprint:**
   - Connect your GitHub repository
   - Render will automatically detect and deploy both services from `render.yaml`
   - The Blueprint includes:
     - Backend Web Service (Node.js, port auto-assigned)
     - Frontend Static Site (serves built files from `dist`)

2. **Environment Variables:**
   - Backend: `CORS_ORIGIN` is pre-configured (update with actual frontend URL after deployment)
   - Frontend: `VITE_SOCKET_SERVER_URL` is pre-configured (update with actual backend URL after deployment)

3. **Post-Deployment Updates:**
   - Update `CORS_ORIGIN` in backend service to match your frontend URL
   - Update `VITE_SOCKET_SERVER_URL` in frontend service to match your backend URL
   - Redeploy both services

### Manual Deployment (Alternative)

If not using Blueprint:

#### Service 1: Backend Web Service

1. Create a Web Service on Render
2. Build command: `cd backend && npm install`
3. Start command: `cd backend && npm start`
4. Add env var: `CORS_ORIGIN` = your frontend URL

#### Service 2: Frontend Static Site

1. Create a Static Site on Render
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. Add env var: `VITE_SOCKET_SERVER_URL` = your backend URL

### Testing

1. **Test Single-Player Mode:** Access frontend URL and verify AI opponents work
2. **Test Multiplayer Mode:** Open in multiple browsers, create/join rooms, verify real-time sync with 10-second timers and 2-card penalties on timeout

### Troubleshooting

- If multiplayer doesn't connect, check `VITE_SOCKET_SERVER_URL` matches backend URL
- Ensure `CORS_ORIGIN` includes your frontend domain
- Backend logs available in Render dashboard
