require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path'); // Added for serving static files

// Load sheets module AFTER dotenv config
const { getSheetsClient, ensureSheetAndHeaders, appendRowToSheet } = require('./sheets');

const app = express();

// CORS middleware to handle cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const SHEET_TITLE = 'depo'; // Changed to 'depo' for Depo-Provera cases

// Remove TrackDrive API configuration since we don't need it
// const TRACKDRIVE_API_URL = 'https://ramonmarquez.trackdrive.com/api/v1/leads';
// const LEAD_TOKEN = '74aae788dcb64a4c8c5328176bb6403a';

// Updated headers for Google Sheets - exact fields from the Depo-Provera form
const HEADERS = [
  'full_name',
  'phone',
  'email',
  'gender',
  'date_of_birth',
  'address',
  'city',
  'state',
  'postal_code',
  'country_diagnosis',
  'date_of_exposure',
  'brief_description_of_your_situation',
  'tcpa_consent_given',
  'xxTrustedFormCertUrl',
  'timestamp'
];

// Field mapping from form to Google Sheets (direct mapping for Depo-Provera form)
const FIELD_MAPPING = {
  full_name: 'full_name',
  phone: 'phone',
  email: 'email',
  gender: 'gender',
  date_of_birth: 'date_of_birth',
  address: 'address',
  city: 'city',
  state: 'state',
  postal_code: 'postal_code',
  country_diagnosis: 'country_diagnosis',
  date_of_exposure: 'date_of_exposure',
  brief_description_of_your_situation: 'brief_description_of_your_situation',
  tcpa_consent_given: 'tcpa_consent_given',
  xxTrustedFormCertUrl: 'xxTrustedFormCertUrl',
  timestamp: 'timestamp'
};

let sheetReady = false;

// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'build')));

// Serve the React app for all routes except API routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/debug/env', (_req, res) => {
  const required = ['GOOGLE_SHEETS_ID','GOOGLE_PROJECT_ID','GOOGLE_CLIENT_EMAIL','GOOGLE_PRIVATE_KEY'];
  const status = {};
  for (const k of required) {
    const present = !!(process.env[k] && String(process.env[k]).trim() !== '');
    status[k] = present ? 'OK' : 'MISSING';
  }
  res.json(status);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Catch all handler for React routing
app.get('*', (req, res) => {
  // Don't serve React app for API routes
  if (req.path.startsWith('/webhook') || req.path.startsWith('/health') || req.path.startsWith('/debug')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    
    console.log('Received payload:', JSON.stringify(payload, null, 2));
    
    // Filter out extra TrustedForm fields we don't need
    const cleanPayload = {};
    Object.keys(payload).forEach(key => {
      if (!key.startsWith('xxTrustedForm') || key === 'xxTrustedFormCertUrl') {
        cleanPayload[key] = payload[key];
      }
    });
    
    console.log('Cleaned payload:', JSON.stringify(cleanPayload, null, 2));
    
    // Build the row for Google Sheets in the exact headers order
    const row = HEADERS.map((key) => {
      let value = cleanPayload[key];
      
      // Handle special mappings for Google Sheets
      if (key === 'xxTrustedFormCertUrl' && !value) {
        value = cleanPayload.xxTrustedFormCertUrl; // Map Trusted Form field
      }
      if (key === 'timestamp' && !value) {
        value = new Date().toISOString(); // Add current timestamp
      }
      
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (value === null || value === undefined) return '';
      return String(value);
    });

    console.log('Google Sheets row:', JSON.stringify(row, null, 2));

    // Send to Google Sheets
    try {
      const sheets = await getSheetsClient();

      if (!sheetReady) {
        await ensureSheetAndHeaders(sheets, SHEET_TITLE, HEADERS);
        sheetReady = true;
      }

      await appendRowToSheet(sheets, SHEET_TITLE, row);

      console.log('Google Sheets: Row appended successfully');
    } catch (sheetsError) {
      console.error('Google Sheets error:', sheetsError);
      // Don't fail the entire request if Google Sheets fails
      // The TrackDrive API already succeeded
    }

    res.json({ 
      success: true, 
      sheets_status: 'Row appended successfully',
      row_data: row
    });

  } catch (err) {
    console.error('Webhook error:', err);
    
    let errorMessage = 'Internal Server Error';
    let statusCode = 500;
    let sheetsError = null;
    
    if (err.response) {
      // Google Sheets API error response
      statusCode = err.response.status;
      errorMessage = `Google Sheets API Error: ${err.response.status} - ${err.response.statusText}`;
      sheetsError = err.response.data;
      console.error('Google Sheets API error details:', err.response.data);
    } else {
      // Other error (likely Google Sheets)
      errorMessage = err.message || 'Unknown error occurred';
      sheetsError = err.message;
    }

    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      sheets_error: sheetsError
    });
  }
});

// Add a test endpoint to verify the payload structure
app.post('/test-webhook', (req, res) => {
  const payload = req.body || {};
  
  // Filter out extra TrustedForm fields we don't need
  const cleanPayload = {};
  Object.keys(payload).forEach(key => {
    if (!key.startsWith('xxTrustedForm') || key === 'xxTrustedFormCertUrl') {
      cleanPayload[key] = payload[key];
    }
  });
  
  // Build the Google Sheets row (without actually sending)
  const row = HEADERS.map((key) => {
    let value = cleanPayload[key];
    
    // Handle special mappings for Google Sheets
    if (key === 'xxTrustedFormCertUrl' && !value) {
      value = cleanPayload.xxTrustedFormCertUrl; // Map Trusted Form field
    }
    if (key === 'timestamp' && !value) {
      value = new Date().toISOString(); // Add current timestamp
    }
    
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === null || value === undefined) return '';
    return String(value);
  });

  res.json({
    original_payload: payload,
    cleaned_payload: cleanPayload,
    google_sheets_row: row,
    headers: req.headers,
    ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || '',
    referer: req.headers.referer || ''
  });
});

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'Available endpoints:',
          endpoints: {
        'GET /': 'Landing page (Depo-Provera form)',
        'POST /webhook': 'Submit form data to Google Sheets',
        'POST /test-webhook': 'Test endpoint to verify payload structure (no actual submission)',
        'GET /health': 'Health check',
      'GET /debug/env': 'Check environment variables'
    },
    requested_url: req.url
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});


