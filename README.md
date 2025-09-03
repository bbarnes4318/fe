# Round Application

A Node.js application with Express backend and React frontend that provides webhook functionality and Google Sheets integration.

## Structure

- `mva-laura/` - Main application directory containing:
  - `index.js` - Express server entry point
  - `src/` - React frontend source code
  - `build/` - Built React application
  - `package.json` - Application dependencies

## Deployment

This application is configured for DigitalOcean App Platform deployment.

### Build Process
1. Install dependencies: `npm install`
2. Build React frontend: `npm run build`
3. Start server: `npm start`

### Environment Variables
Required environment variables (set in DigitalOcean App Platform):
- `GOOGLE_SHEETS_ID`
- `GOOGLE_PROJECT_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /webhook` - Main webhook endpoint for form submissions
- `GET /debug/env` - Environment variable debug endpoint

## Health Check

The application exposes a health check endpoint at `/health` for DigitalOcean App Platform monitoring.
