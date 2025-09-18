const { google } = require('googleapis');

const REQUIRED_ENVS = ['GOOGLE_SHEETS_ID', 'GOOGLE_PROJECT_ID', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'];

function assertEnv() {
  console.log('DEBUG: assertEnv called');
  console.log('DEBUG: process.env.GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID);
  console.log('DEBUG: process.env.GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID);
  console.log('DEBUG: process.env.GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL);
  console.log('DEBUG: process.env.GOOGLE_PRIVATE_KEY length:', process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.length : 'undefined');
  
  const missing = REQUIRED_ENVS.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function getSheetsClient() {
  // Check environment variables when function is called, not when module loads
  assertEnv();

  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  
  console.log('DEBUG: Original private key length:', privateKey ? privateKey.length : 'undefined');
  console.log('DEBUG: Private key starts with:', privateKey ? privateKey.substring(0, 50) : 'undefined');
   
  // Handle different key formats
  if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    console.log('DEBUG: Replaced \\n with actual newlines');
  }
  
  // Strip quotes if present
  if (privateKey && ((privateKey.startsWith('"') && privateKey.endsWith('"')) || 
      (privateKey.startsWith("'") && privateKey.endsWith("'")))) {
    privateKey = privateKey.slice(1, -1);
    console.log('DEBUG: Stripped quotes from private key');
  }

  // Ensure the private key has proper formatting and handle line breaks
  if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    // If it's a raw key, wrap it properly
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    console.log('DEBUG: Wrapped raw key with proper headers');
  } else if (privateKey) {
    // Ensure proper line breaks for existing formatted keys
    privateKey = privateKey.replace(/\\n/g, '\n');
    console.log('DEBUG: Ensured proper line breaks in formatted key');
  }
  
  console.log('DEBUG: Final private key length:', privateKey ? privateKey.length : 'undefined');

  // Use GoogleAuth which is more compatible with newer Node.js versions
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  return sheets;
}

async function getSpreadsheet(sheets) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const { data } = await sheets.spreadsheets.get({ spreadsheetId });
  return data;
}

async function findSheetByTitle(sheets, title) {
  const spreadsheet = await getSpreadsheet(sheets);
  const sheet = (spreadsheet.sheets || []).find((s) => s.properties && s.properties.title === title);
  return sheet ? sheet.properties : null;
}

async function createSheetIfMissing(sheets, title) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const existing = await findSheetByTitle(sheets, title);
  if (existing) return existing;

  const { data } = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title,
              gridProperties: { rowCount: 1000, columnCount: 26 },
            },
          },
        },
      ],
    },
  });
  const replies = data.replies || [];
  const added = replies[0]?.addSheet?.properties || null;
  return added;
}

async function ensureHeaderRow(sheets, title, headers) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const range = `${title}!1:1`;
  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const existing = data.values && data.values[0];
  if (!existing || existing.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    return;
  }
  // If headers exist but differ, replace to enforce exact order
  const serializedExisting = JSON.stringify(existing);
  const serializedExpected = JSON.stringify(headers);
  if (serializedExisting !== serializedExpected) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
  }
}

async function ensureSheetAndHeaders(sheets, title, headers) {
  await createSheetIfMissing(sheets, title);
  await ensureHeaderRow(sheets, title, headers);
}

async function appendRowToSheet(sheets, title, row) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const range = `${title}!A:A`;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

module.exports = {
  getSheetsClient,
  getSpreadsheet,
  ensureSheetAndHeaders,
  appendRowToSheet,
};
