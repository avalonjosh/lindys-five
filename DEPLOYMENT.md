# Deployment Guide

## Deploying to Vercel (Recommended)

### Option 1: Vercel CLI

1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Navigate to your project directory:
   ```bash
   cd sabres-tracker
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. For production deployment:
   ```bash
   vercel --prod
   ```

### Option 2: GitHub Integration (Automatic Deployments)

1. Push your code to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Sabres tracker app"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) and sign in

3. Click "Add New Project"

4. Import your GitHub repository

5. Vercel will auto-detect the Vite configuration

6. Click "Deploy"

Your app will be deployed and you'll get a live URL. Every push to main will trigger a new deployment automatically!

## Other Deployment Options

### Netlify

1. Build the project:
   ```bash
   npm run build
   ```

2. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

3. Deploy:
   ```bash
   netlify deploy --prod --dir=dist
   ```

### GitHub Pages

1. Install gh-pages:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Add to package.json scripts:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

## Environment Configuration

No environment variables are needed for this app. It uses the public NHL API which doesn't require authentication.

## Post-Deployment

After deployment:
- The app will automatically fetch Sabres schedule and results
- Data refreshes every 5 minutes automatically
- Users can manually refresh using the "Refresh Data" button
- No database or backend required

## Monitoring

Check the browser console for any API errors. If the NHL API changes, you may need to update the API endpoints in [src/services/nhlApi.ts](src/services/nhlApi.ts).
