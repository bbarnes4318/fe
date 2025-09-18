# Depo-Provera Meningioma Legal Consultation

A Node.js application with Express backend and React frontend that provides a single-page landing page for individuals diagnosed with Meningioma after using Depo-Provera. The application includes form submission functionality with Google Sheets integration and TrustedForm compliance.

## Structure

- `mva-laura/` - Main application directory containing:
  - `index.js` - Express server entry point
  - `src/` - React frontend source code
  - `build/` - Built React application
  - `package.json` - Application dependencies

## Features

- Single-page responsive form design
- TrustedForm integration for compliance
- Google Sheets integration (sheet name: 'depo')
- Form validation and error handling
- Clean, professional UI design

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

- `GET /` - Landing page with Depo-Provera form
- `POST /webhook` - Main webhook endpoint for form submissions
- `POST /test-webhook` - Test endpoint to verify payload structure
- `GET /health` - Health check endpoint
- `GET /debug/env` - Environment variable debug endpoint

## Form Fields

The form collects the following information:
- Personal details (name, phone, email, gender, date of birth)
- Address information (address, city, state, postal code)
- Medical information (date of exposure to Depo-Provera, brief description)
- Hidden fields for compliance (country_diagnosis, tcpa_consent_given, xxTrustedFormCertUrl, timestamp)

## Health Check

The application exposes a health check endpoint at `/health` for DigitalOcean App Platform monitoring.
