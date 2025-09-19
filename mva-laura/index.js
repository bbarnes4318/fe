require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const http = require('http');
const path = require('path'); // Added for serving static files

// Load sheets module AFTER dotenv config
const { getSheetsClient, getSpreadsheet, ensureSheetAndHeaders, appendRowToSheet } = require('./sheets');

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
const SHEET_TITLE = 'fe'; // Changed to 'fe' for final expense insurance

// Remove TrackDrive API configuration since we don't need it
// const TRACKDRIVE_API_URL = 'https://ramonmarquez.trackdrive.com/api/v1/leads';
// const LEAD_TOKEN = '74aae788dcb64a4c8c5328176bb6403a';

// Updated headers for Google Sheets - exact fields from the final expense insurance form
// NOTE: Added minimal IP geolocation fields to verify state matching without requiring ZIP
const HEADERS = [
  'full_name',
  'phone',
  'email',
  'gender',
  'date_of_birth',
  'state',
  'tcpa_consent_given',
  'xxTrustedFormCertUrl',
  'timestamp',
  // appended fields (safe to add — older rows will be blank)
  'ip_masked',
  'ip_source',
  'ip_region_code',
  'ip_region_name',
  'ip_zip',
  'ip_state_match'
];

// Field mapping from form to Google Sheets (direct mapping for final expense insurance form)
const FIELD_MAPPING = {
  full_name: 'full_name',
  phone: 'phone',
  email: 'email',
  gender: 'gender',
  date_of_birth: 'date_of_birth',
  state: 'state',
  tcpa_consent_given: 'tcpa_consent_given',
  xxTrustedFormCertUrl: 'xxTrustedFormCertUrl',
  timestamp: 'timestamp'
};

// --- State helpers: accept either full state name (e.g., "California") or code (e.g., "CA") ---
const STATE_CODE_TO_NAME = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia'
};
const STATE_NAME_TO_CODE = Object.fromEntries(
  Object.entries(STATE_CODE_TO_NAME).map(([code, name]) => [name.toLowerCase(), code])
);

function normalizeState(value) {
  if (!value || typeof value !== 'string') return { code: '', name: '' };
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (STATE_CODE_TO_NAME[upper]) return { code: upper, name: STATE_CODE_TO_NAME[upper] };
  const code = STATE_NAME_TO_CODE[trimmed.toLowerCase()] || '';
  return code ? { code, name: STATE_CODE_TO_NAME[code] } : { code: '', name: '' };
}

function getClientIP(req) {
  try {
    const xff = req.headers['x-forwarded-for'];
    let ip = Array.isArray(xff) ? xff[0] : (xff ? String(xff).split(',')[0].trim() : '');
    if (!ip) ip = req.headers['x-real-ip'] || '';
    if (!ip) ip = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
    if (ip && ip.startsWith('::ffff:')) ip = ip.slice(7);
    return ip || '';
  } catch (e) {
    return '';
  }
}

function isPrivateIP(ip) {
  if (!ip) return true;
  return (
    ip === '127.0.0.1' || ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    (/^172\.(1[6-9]|2\d|3[0-1])\./).test(ip)
  );
}

// Anonymize IP for logging/storage (IPv4 -> /24, IPv6 -> /64). Removes zone index if present.
function maskIP(ip) {
  if (!ip || typeof ip !== 'string') return '';
  try {
    if (ip.startsWith('::ffff:')) ip = ip.slice(7); // strip IPv4-mapped prefix
    const zoneIdx = ip.indexOf('%');
    if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx);
    // IPv4
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      const parts = ip.split('.');
      parts[3] = '0';
      return parts.join('.') + '/24';
    }
    // IPv6 (very rough mask)
    const hextets = ip.split(':');
    if (hextets.length > 1) {
      return hextets.slice(0, 4).join(':') + '::/64';
    }
    return '';
  } catch (e) {
    return '';
  }
}

async function lookupIpGeo(ip) {
  try {
    // Use ipwho.is (no key needed). If IP is private/empty, query without an IP (will return server IP — may be less useful locally)
    const target = (!ip || isPrivateIP(ip)) ? '' : encodeURIComponent(ip);
    const url = target ? `https://ipwho.is/${target}` : 'https://ipwho.is/';
    const { data } = await axios.get(url, { timeout: 4000 });
    if (data && data.success !== false) return data;
    return null;
  } catch (e) {
    return null;
  }
}

// --- Proxy IP selection based on entered state ---
// Supports either:
// 1) Calling your Flask service POST /get-proxy with { area_code: <zip> } to obtain proxy credentials, or
// 2) Direct DataImpulse credentials via env: PROXY_HOST, PROXY_PORT, PROXY_BASE_USER, PROXY_PASS
const PROXY_SERVICE_URL = process.env.PROXY_SERVICE_URL || '';
const DATAIMPULSE = {
  host: process.env.PROXY_HOST || '',
  port: process.env.PROXY_PORT || '',
  baseUser: process.env.PROXY_BASE_USER || '',
  pass: process.env.PROXY_PASS || ''
};

// Representative ZIP per state (typically capital or major city center)
const STATE_TO_ZIP = {
  AL: '36104', AK: '99501', AZ: '85001', AR: '72201', CA: '95814', CO: '80202',
  CT: '06103', DE: '19901', FL: '32301', GA: '30303', HI: '96813', ID: '83702',
  IL: '62701', IN: '46204', IA: '50309', KS: '66603', KY: '40601', LA: '70802',
  ME: '04330', MD: '21401', MA: '02108', MI: '48933', MN: '55102', MS: '39205',
  MO: '65101', MT: '59601', NE: '68508', NV: '89701', NH: '03301', NJ: '08608',
  NM: '87501', NY: '12207', NC: '27601', ND: '58501', OH: '43215', OK: '73102',
  OR: '97301', PA: '17101', RI: '02903', SC: '29201', SD: '57501', TN: '37219',
  TX: '78701', UT: '84111', VT: '05602', VA: '23219', WA: '98501', WV: '25301',
  WI: '53703', WY: '82001', DC: '20001'
};

// Secondary city ZIPs per state to improve proxy success rates (expand as needed)
const SECONDARY_ZIPS = {
  PA: ['19103', '15222', '18101', '19067'], // Philadelphia, Pittsburgh, Allentown, Bucks Cnty
  CA: ['90012', '94103', '95814', '92805'], // LA, SF, Sacramento, Anaheim
  TX: ['77002', '75201', '78701', '78205'], // Houston, Dallas, Austin, San Antonio
  FL: ['33130', '33602', '32801', '32202'], // Miami, Tampa, Orlando, Jacksonville
  NY: ['10007', '11201', '14604', '12207'], // Manhattan, Brooklyn, Rochester, Albany
  IL: ['60601', '60302', '62701'],          // Chicago, Oak Park, Springfield
  MI: ['48226', '49503', '48933'],          // Detroit, Grand Rapids, Lansing
  TN: ['37219', '38103', '37902']           // Nashville, Memphis, Knoxville
};

function pickZipsForState(code) {
  const primary = STATE_TO_ZIP[code];
  const extras = SECONDARY_ZIPS[code] || [];
  const list = [];
  if (primary) list.push(primary);
  for (const z of extras) if (!list.includes(z)) list.push(z);
  return list;
}

async function getProxyConfigForZip(zip) {
  // Prefer external Flask service if provided
  if (PROXY_SERVICE_URL) {
    try {
      const base = PROXY_SERVICE_URL.endsWith('/') ? PROXY_SERVICE_URL.slice(0, -1) : PROXY_SERVICE_URL;
      const { data } = await axios.post(`${base}/get-proxy`, { area_code: zip }, { timeout: 5000 });
      const p = data?.proxy;
      if (p?.host && p?.port && p?.user && p?.pass) {
        return { host: String(p.host), port: String(p.port), user: String(p.user), pass: String(p.pass) };
      }
    } catch (e) {
      console.warn('Proxy service /get-proxy failed:', e?.message || e);
    }
  }
  // Fallback to direct DataImpulse credentials from env
  if (DATAIMPULSE.host && DATAIMPULSE.port && DATAIMPULSE.baseUser && DATAIMPULSE.pass) {
    return { host: DATAIMPULSE.host, port: DATAIMPULSE.port, user: `${DATAIMPULSE.baseUser};zip.${zip}`, pass: DATAIMPULSE.pass };
  }
  return null;
}

async function getIpViaProxy(proxy) {
  const targets = [
    'http://whatismyip.akamai.com/',
    'http://api.ipify.org?format=text',
    'http://ipinfo.io/ip'
  ];
  for (const url of targets) {
    try {
      const text = await getTextViaHttpProxy(proxy, url, 8000);
      if (text && /\d+\.\d+\.\d+\.\d+/.test(text)) return text.trim();
    } catch (_) {}
  }
  return '';
}

// Low-level HTTP proxy request helpers (no extra deps)
function getTextViaHttpProxy(proxy, targetUrl, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(targetUrl);
      if (urlObj.protocol !== 'http:') {
        return reject(new Error('Only http:// URLs supported for proxy fetch'));
      }
      const auth = Buffer.from(`${proxy.user}:${proxy.pass}`).toString('base64');
      const options = {
        host: proxy.host,
        port: parseInt(proxy.port, 10),
        method: 'GET',
        path: urlObj.href,
        headers: {
          Host: urlObj.host,
          'Proxy-Authorization': `Basic ${auth}`,
          'Proxy-Connection': 'Keep-Alive',
          Connection: 'close',
          'User-Agent': 'NodeProxy/1.0'
        },
        timeout: timeoutMs
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Proxy status ${res.statusCode}`));
          }
        });
      });
      req.on('timeout', () => { req.destroy(new Error('Proxy timeout')); });
      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function getGeoViaProxy(proxy) {
  try {
    const text = await getTextViaHttpProxy(proxy, 'http://ip-api.com/json', 10000);
    const data = JSON.parse(text);
    if (data && data.status === 'success') {
      return {
        ip: String(data.query || '').trim(),
        region_code: String(data.region || '').toUpperCase(),
        region: String(data.regionName || ''),
        postal: String(data.zip || '')
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function getProxyIpForState(stateObj) {
  const code = (stateObj?.code || '').toUpperCase();
  if (!code) return null;
  const candidates = pickZipsForState(code);
  for (const zip of candidates) {
    const cfg = await getProxyConfigForZip(zip);
    if (!cfg) continue;
    console.log(`[proxy] Trying state ${code} with ZIP ${zip} via ${PROXY_SERVICE_URL ? 'service' : 'env creds'}...`);
    // First try to get geo directly through the proxy (fast path)
    const geoDirect = await getGeoViaProxy(cfg);
    if (geoDirect && geoDirect.region_code === code) {
      console.log(`[proxy] Direct geo success for ${code} -> ${geoDirect.ip} (${geoDirect.region})`);
      return { ip: geoDirect.ip, region_code: geoDirect.region_code, region: geoDirect.region, postal: geoDirect.postal, zip, source: 'proxy' };
    }
    // Fallback: get IP via proxy, then geolocate
    const ip = await getIpViaProxy(cfg);
    if (!ip) continue;
    const geo = await lookupIpGeo(ip);
    const region_code = (geo?.region_code || '').toUpperCase();
    const region = (geo?.region || '');
    const postal = (geo?.postal || '');
    if (region_code && region_code === code) {
      console.log(`[proxy] IP fetch+geo success for ${code} -> ${ip} (${region})`);
      return { ip, region_code, region, postal, zip, source: 'proxy' };
    }
    console.warn(`[proxy] Mismatch for ${code} using ZIP ${zip}: got ${region_code || 'UNKNOWN'} (${region || 'unknown'})`);
  }
  console.error(`[proxy] Failed to acquire proxy IP in state ${code}. Falling back to client IP.`);
  return null;
}

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
    if (k === 'GOOGLE_PRIVATE_KEY' && present) {
      status[k + '_length'] = process.env[k].length;
      status[k + '_starts_with'] = process.env[k].substring(0, 20) + '...';
    }
  }
  res.json(status);
});

// Test Google Sheets connection
app.get('/debug/sheets', async (_req, res) => {
  try {
    console.log('Testing Google Sheets connection...');
    const sheets = await getSheetsClient();
    console.log('Sheets client created successfully');
    
    const spreadsheet = await getSpreadsheet(sheets);
    console.log('Spreadsheet accessed successfully');
    
    res.json({
      success: true,
      spreadsheet_title: spreadsheet.properties.title,
      sheets: spreadsheet.sheets.map(s => s.properties.title),
      message: 'Google Sheets connection successful'
    });
  } catch (error) {
    console.error('Google Sheets test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || 'No additional details'
    });
  }
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
    
    // --- IP vs State matching (state-only; ZIP not required) ---
    const inputState = normalizeState(cleanPayload.state);
    let ipSource = 'client';
    let resolvedIp = '';
    let ipRegionCode = '';
    let ipRegionName = '';
    let ipPostal = '';

    // Prefer proxy-matched IP if configured
    const proxyResult = await getProxyIpForState(inputState);
    if (proxyResult && proxyResult.ip) {
      ipSource = 'proxy';
      resolvedIp = proxyResult.ip;
      // Validate with geo lookup to confirm region
      const ipGeo = await lookupIpGeo(resolvedIp);
      ipRegionCode = (ipGeo?.region_code || proxyResult.region_code || '').toUpperCase();
      ipRegionName = ipGeo?.region || '';
      ipPostal = ipGeo?.postal || proxyResult.zip || '';
    } else {
      // Fallback to client IP geolocation
      const clientIp = getClientIP(req);
      const ipGeo = await lookupIpGeo(clientIp);
      resolvedIp = ipGeo?.ip || clientIp || '';
      ipRegionCode = (ipGeo?.region_code || '').toUpperCase();
      ipRegionName = ipGeo?.region || '';
      ipPostal = ipGeo?.postal || '';
    }

    const stateMatch = inputState.code && ipRegionCode ? (inputState.code === ipRegionCode) : '';
    
    // Attach minimal IP fields for Sheets logging (masked only)
    cleanPayload.ip_masked = maskIP(resolvedIp);
    cleanPayload.ip_source = ipSource;
    cleanPayload.ip_region_code = ipRegionCode;
    cleanPayload.ip_region_name = ipRegionName;
    cleanPayload.ip_zip = ipPostal;
    cleanPayload.ip_state_match = (stateMatch === '') ? 'Unknown' : (stateMatch ? 'Yes' : 'No');
    
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
      if (key === 'tcpa_consent_given' && !value) {
        value = 'Yes'; // Default value
      }
      
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (value === null || value === undefined) return '';
      return String(value);
    });

    console.log('Google Sheets row:', JSON.stringify(row, null, 2));

    // Send to Google Sheets
    let sheetsSuccess = false;
    let sheetsError = null;
    
    try {
      console.log('Attempting to connect to Google Sheets...');
      console.log('Sheet title:', SHEET_TITLE);
      console.log('Headers:', HEADERS);
      console.log('Row data:', row);
      
      const sheets = await getSheetsClient();
      console.log('Google Sheets client created successfully');

      if (!sheetReady) {
        console.log('Setting up sheet and headers...');
        await ensureSheetAndHeaders(sheets, SHEET_TITLE, HEADERS);
        sheetReady = true;
        console.log('Sheet and headers setup complete');
      }

      console.log('Appending row to sheet...');
      await appendRowToSheet(sheets, SHEET_TITLE, row);

      console.log('Google Sheets: Row appended successfully');
      sheetsSuccess = true;
    } catch (error) {
      console.error('Google Sheets error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        response: error.response?.data,
        stack: error.stack
      });
      sheetsError = error;
    }

    res.json({ 
      success: sheetsSuccess, 
      sheets_status: sheetsSuccess ? 'Row appended successfully' : 'Failed to append row',
      sheets_error: sheetsError ? sheetsError.message : null,
      row_data: row,
      sheet_name: SHEET_TITLE,
      ip_check: {
        ip_masked: maskIP(resolvedIp),
        ip_source: ipSource,
        ip_region_code: ipRegionCode,
        ip_region_name: ipRegionName,
        ip_zip: ipPostal,
        input_state: inputState,
        match: cleanPayload.ip_state_match
      }
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
app.post('/test-webhook', async (req, res) => {
  const payload = req.body || {};
  
  // Filter out extra TrustedForm fields we don't need
  const cleanPayload = {};
  Object.keys(payload).forEach(key => {
    if (!key.startsWith('xxTrustedForm') || key === 'xxTrustedFormCertUrl') {
      cleanPayload[key] = payload[key];
    }
  });

  // Compute IP via proxy for entered state (same logic as /webhook)
  const inputState = normalizeState(cleanPayload.state);
  let ipSource = 'client';
  let resolvedIp = '';
  let ipRegionCode = '';
  let ipRegionName = '';
  let ipPostal = '';

  const proxyResult = await getProxyIpForState(inputState);
  if (proxyResult && proxyResult.ip) {
    ipSource = 'proxy';
    resolvedIp = proxyResult.ip;
    const ipGeo = await lookupIpGeo(resolvedIp);
    ipRegionCode = (ipGeo?.region_code || proxyResult.region_code || '').toUpperCase();
    ipRegionName = ipGeo?.region || '';
    ipPostal = ipGeo?.postal || proxyResult.zip || '';
  } else {
    const clientIp = getClientIP(req);
    const ipGeo = await lookupIpGeo(clientIp);
    resolvedIp = ipGeo?.ip || clientIp || '';
    ipRegionCode = (ipGeo?.region_code || '').toUpperCase();
    ipRegionName = ipGeo?.region || '';
    ipPostal = ipGeo?.postal || '';
  }

  const stateMatch = inputState.code && ipRegionCode ? (inputState.code === ipRegionCode) : '';

  cleanPayload.ip_masked = maskIP(resolvedIp);
  cleanPayload.ip_source = ipSource;
  cleanPayload.ip_region_code = ipRegionCode;
  cleanPayload.ip_region_name = ipRegionName;
  cleanPayload.ip_zip = ipPostal;
  cleanPayload.ip_state_match = (stateMatch === '') ? 'Unknown' : (stateMatch ? 'Yes' : 'No');
  
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
    ip_check: {
      ip_masked: maskIP(resolvedIp),
      ip_source: ipSource,
      ip_region_code: ipRegionCode,
      ip_region_name: ipRegionName,
      ip_zip: ipPostal,
      input_state: inputState,
      match: cleanPayload.ip_state_match
    },
    referer: req.headers.referer || ''
  });
});

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'Available endpoints:',
          endpoints: {
        'GET /': 'Landing page (Final Expense Insurance form)',
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


