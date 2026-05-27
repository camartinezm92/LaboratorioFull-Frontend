import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import { google } from 'googleapis';

dotenv.config();
// Fallback to .env.example if variables are missing
if (fs.existsSync('.env.example')) {
  const exampleConfig = dotenv.parse(fs.readFileSync('.env.example'));
  for (const key in exampleConfig) {
    if (!process.env[key]) {
      process.env[key] = exampleConfig[key];
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lastLogs: string[] = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  lastLogs.push(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
  if (lastLogs.length > 50) lastLogs.shift();
  originalLog(...args);
};
console.error = (...args) => {
  lastLogs.push(`[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
  if (lastLogs.length > 50) lastLogs.shift();
  originalError(...args);
};
console.warn = (...args) => {
  lastLogs.push(`[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
  if (lastLogs.length > 50) lastLogs.shift();
  originalWarn(...args);
};

const parsePrivateKey = (key: string) => {
  let privateKey = key.trim();
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }
  if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  }
  return privateKey;
};

const extractSpreadsheetId = (idOrUrl: string) => {
  if (!idOrUrl) return '';
  // If it's a URL, extract the ID
  const match = idOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : idOrUrl;
};

// Google Sheets Configuration
const getSheetsClient = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    console.warn('Google Service Account credentials missing in .env');
    return null;
  }

  const privateKey = parsePrivateKey(rawKey);

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/cloud-platform'
    ],
  });

  return google.sheets({ version: 'v4', auth });
};

const SHEET_MAPPINGS: Record<string, { sheetName: string; columns: string[] }> = {
  'receivedUnits': {
    sheetName: 'Recepción',
    columns: [
      'receptionDate', 'receptionTime', 'provider', 'hemoderivativeType', 'unitId', 
      'qualitySeal', 'bloodGroup', 'rh', 'volume', 'sampleDate', 'expirationDate', 
      'packagingIntegrity', 'contentAspect', 'temperature', 'observations', 
      'accepted', 'status', 'receiverName', 'supervisorName', 
      'reclassified', 'reclassifiedBloodGroup', 'reclassifiedRh', 'reclassifiedComment',
      'rejectionReason', 'actionsTaken', 'reporterName', 'createdAt', 'updatedAt', 'updatedBy'
    ]
  },
  'bloodTestRecords': {
    sheetName: 'Pre-transfusional',
    columns: [
      'patientName', 'patientId', 'eps', 'age', 'gender', 'bloodGroup', 'rh', 
      'testDate', 'result', 'status', 'unitId', 'unitGroup', 'unitRh', 'unitExpirationDate', 
      'irregularAntibodies', 'autocontrol', 'temperature', 'provider', 
      'requestedHemoderivative', 'requestType', 'qualitySeal', 
      'justification', 'siheviReport', 'siheviDescription', 'siheviPredefinedText',
      'acceptedBy', 'acceptedAt', 'returned', 'returnComment', 'returnedAt',
      'bacteriologist', 'registryNumber', 'observations', 'createdAt', 'updatedAt', 'updatedBy'
    ]
  },
  'transfusionUse': {
    sheetName: 'Uso',
    columns: [
      'service', 'patientName', 'patientId', 'age', 'gender', 'hemoderivativeType', 
      'bloodGroup', 'rh', 'orderDate', 'orderTime', 'transfusionDate', 
      'transfusionTime', 'opportunity', 'qualitySeal', 'unitId', 
      'prescriptionFormat', 'informedConsent', 'adminChecklist', 'nursingNote', 'adverseReaction', 
      'safetyEvent', 'reactionDescription', 'responsibleDoctor', 
      'responsibleNurse', 'observations', 'createdAt', 'updatedAt', 'updatedBy'
    ]
  },
  'finalDisposition': {
    sheetName: 'Disposición Final',
    columns: [
      'unitId', 'qualitySeal', 'dispositionDate', 'dispositionType', 'reason', 
      'responsiblePerson', 'observations', 'createdAt', 'updatedAt', 'updatedBy'
    ]
  },
  'logs': {
    sheetName: 'Logs de Edición',
    columns: ['timestamp', 'userEmail', 'recordId', 'collection', 'action', 'field', 'oldValue', 'newValue']
  },
  'labResults': {
    sheetName: 'RLaboratorios',
    columns: [
      'date', 'patientName', 'clinicalHistoryNumber', 'age', 'eps', 'studyType',
      'p1_v', 'p1_u', 'p1_r', 'p1_s', 'p1_a',
      'p2_v', 'p2_u', 'p2_r', 'p2_s', 'p2_a',
      'p3_v', 'p3_u', 'p3_r', 'p3_s', 'p3_a',
      'p4_v', 'p4_u', 'p4_r', 'p4_s', 'p4_a',
      'p5_v', 'p5_u', 'p5_r', 'p5_s', 'p5_a',
      'p6_v', 'p6_u', 'p6_r', 'p6_s', 'p6_a',
      'p7_v', 'p7_u', 'p7_r', 'p7_s', 'p7_a',
      'p8_v', 'p8_u', 'p8_r', 'p8_s', 'p8_a',
      'p9_v', 'p9_u', 'p9_r', 'p9_s', 'p9_a',
      'p10_v', 'p10_u', 'p10_r', 'p10_s', 'p10_a',
      'p11_v', 'p11_u', 'p11_r', 'p11_s', 'p11_a',
      'p12_v', 'p12_u', 'p12_r', 'p12_s', 'p12_a',
      'p13_v', 'p13_u', 'p13_r', 'p13_s', 'p13_a',
      'p14_v', 'p14_u', 'p14_r', 'p14_s', 'p14_a',
      'p15_v', 'p15_u', 'p15_r', 'p15_s', 'p15_a',
      'p16_v', 'p16_u', 'p16_r', 'p16_s', 'p16_a',
      'p17_v', 'p17_u', 'p17_r', 'p17_s', 'p17_a',
      'p18_v', 'p18_u', 'p18_r', 'p18_s', 'p18_a',
      'p19_v', 'p19_u', 'p19_r', 'p19_s', 'p19_a',
      'p20_v', 'p20_u', 'p20_r', 'p20_s', 'p20_a',
      'p21_v', 'p21_u', 'p21_r', 'p21_s', 'p21_a',
      'p22_v', 'p22_u', 'p22_r', 'p22_s', 'p22_a',
      'generalAnalysis', 'bacteriologist', 'registryNumber'
    ]
  },
  'kardexEntries': {
    sheetName: 'KARDEXLAB',
    columns: [
      'date', 
      'supplyName', 
      'supplyCategory', 
      'type', 
      'actionType', 
      'quantity', 
      'balance', 
      'batch', 
      'expirationDate', 
      'invimaRecord', 
      'responsible', 
      'observations'
    ]
  },
  'inventoryClosures': {
    sheetName: 'Inventario',
    columns: [
      'date', 
      'responsible', 
      'itemName', 
      'category', 
      'batch', 
      'expirationDate', 
      'invimaRecord',
      'stock', 
      'unit'
    ]
  }
};

/**
 * Formats a value for Google Sheets to be more human-readable.
 */
function formatSheetValue(value: any, key: string): string {
  if (value === null || value === undefined) return '';
  
  // Format parameters array for labResults
  if (key === 'parameters' && Array.isArray(value)) {
    return value.map(p => `${p.name}: ${p.value} ${p.unit} (${p.status})`).join(' | ');
  }
  
  // Format ISO timestamps and date fields
  const isDateKey = key === 'date' || key.endsWith('At') || key === 'createdAt' || key === 'updatedAt' || key === 'timestamp' || 
                    key.toLowerCase().includes('date') || key.toLowerCase().includes('time');

  if (isDateKey && value) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        // Use Intl.DateTimeFormat to force Colombia Time Zone (America/Bogota)
        const formatter = new Intl.DateTimeFormat('es-CO', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        const parts = formatter.formatToParts(date);
        const p: Record<string, string> = {};
        parts.forEach(part => p[part.type] = part.value);
        
        // Return in format: DD/MM/YYYY HH:mm:ss
        return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
      }
    } catch (e) {
      return String(value);
    }
  }
  
  // Format booleans
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }

  // Format action types for better readability in Excel
  if (key === 'actionType') {
    const actions: Record<string, string> = {
      'edit_supply': 'Edición de Insumo',
      'delete_supply': 'Eliminación de Insumo',
      'edit_batch': 'Edición de Lote',
      'delete_batch': 'Eliminación de Lote',
      'input': 'Entrada de Stock',
      'output': 'Salida de Stock'
    };
    return actions[value] || value || 'Movimiento';
  }

  if (key === 'type') {
    const types: Record<string, string> = {
      'input': 'ENTRADA',
      'output': 'SALIDA',
      'action': 'ACCIÓN/AUDITORÍA'
    };
    return types[value] || value;
  }
  
  return String(value);
}

async function appendToSheet(collectionName: string, data: any) {
  const mapping = SHEET_MAPPINGS[collectionName];
  if (!mapping) {
    console.warn(`No mapping found for collection: ${collectionName}`);
    return;
  }

  const sheets = getSheetsClient();
  if (!sheets) {
    console.error('Google Sheets client not initialized. Check service account credentials.');
    return;
  }

  const envKey = collectionName === 'labResults' 
    ? 'GOOGLE_SHEETS_LABORATORIO_ID' 
    : (collectionName === 'kardexEntries' || collectionName === 'inventoryClosures')
      ? 'GOOGLE_SHEETS_KARDEX_ID'
      : 'GOOGLE_SHEETS_HEMODERIVADOS_ID';

  const rawSpreadsheetId = process.env[envKey];
  if (!rawSpreadsheetId) {
    console.error(`${envKey} not found in environment.`);
    return;
  }

  const spreadsheetId = extractSpreadsheetId(rawSpreadsheetId);
  
  // Flatten parameters for labResults
  const flattenedData = { ...data };
  if (collectionName === 'labResults' && Array.isArray(data.parameters)) {
    data.parameters.forEach((p: any, i: number) => {
      if (i < 22) {
        flattenedData[`p${i+1}_v`] = p.value;
        flattenedData[`p${i+1}_u`] = p.unit;
        flattenedData[`p${i+1}_r`] = p.referenceRange;
        flattenedData[`p${i+1}_s`] = p.status;
        flattenedData[`p${i+1}_a`] = p.analysis;
      }
    });
  }

  const row = mapping.columns.map(col => formatSheetValue(flattenedData[col], col));
  const quotedSheetName = `'${mapping.sheetName}'`;
  console.log(`Appending row to sheet ${mapping.sheetName} in spreadsheet ${spreadsheetId.substring(0, 5)}...${spreadsheetId.substring(spreadsheetId.length - 5)}`);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quotedSheetName}!A:A`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row]
      }
    });
    console.log(`Appended to sheet ${mapping.sheetName}`);
  } catch (err: any) {
    console.error(`Error appending to sheet ${mapping.sheetName}:`, err.message);
    if (err.response) {
      console.error('Google API Response Error:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

async function updateRowInSheet(collectionName: string, data: any, oldData: any, userEmail: string) {
  const mapping = SHEET_MAPPINGS[collectionName];
  if (!mapping) {
    console.warn(`No mapping found for collection: ${collectionName}`);
    return;
  }

  const sheets = getSheetsClient();
  if (!sheets) {
    console.error('Google Sheets client not initialized. Check service account credentials.');
    return;
  }

  const envKey = collectionName === 'labResults' 
    ? 'GOOGLE_SHEETS_LABORATORIO_ID' 
    : (collectionName === 'kardexEntries' || collectionName === 'inventoryClosures')
      ? 'GOOGLE_SHEETS_KARDEX_ID'
      : 'GOOGLE_SHEETS_HEMODERIVADOS_ID';

  const rawSpreadsheetId = process.env[envKey];
  if (!rawSpreadsheetId) {
    console.error(`${envKey} not found in environment.`);
    return;
  }

  const spreadsheetId = extractSpreadsheetId(rawSpreadsheetId);
  const targetId = data.unitId || data.id;
  console.log(`Updating row in sheet ${mapping.sheetName} for ID ${targetId}`);

  // Flatten parameters for labResults
  const flattenedData = { ...data };
  if (collectionName === 'labResults' && Array.isArray(data.parameters)) {
    data.parameters.forEach((p: any, i: number) => {
      if (i < 22) {
        flattenedData[`p${i+1}_v`] = p.value;
        flattenedData[`p${i+1}_u`] = p.unit;
        flattenedData[`p${i+1}_r`] = p.referenceRange;
        flattenedData[`p${i+1}_s`] = p.status;
        flattenedData[`p${i+1}_a`] = p.analysis;
      }
    });
  }

  try {
    // Find the row to update. We'll use 'id' or 'unitId' as the identifier.
    // First, get all values in the sheet
    const quotedSheetName = `'${mapping.sheetName}'`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quotedSheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return;

    // Find the index of the ID column
    const idColIndex = mapping.columns.indexOf('unitId') !== -1 
      ? mapping.columns.indexOf('unitId') 
      : mapping.columns.indexOf('id');
    
    if (idColIndex === -1) return;

    const targetId = data.unitId || data.id;
    const rowIndex = rows.findIndex(row => row[idColIndex] === targetId);

    if (rowIndex !== -1) {
      const newRow = mapping.columns.map(col => formatSheetValue(flattenedData[col], col));
      const range = `${quotedSheetName}!A${rowIndex + 1}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [newRow]
        }
      });
      console.log(`Updated row ${rowIndex + 1} in sheet ${mapping.sheetName}`);

      // Log the changes
      const timestamp = new Date().toISOString();
      for (const col of mapping.columns) {
        if (data[col] !== oldData[col]) {
          const logData = {
            timestamp,
            userEmail,
            recordId: targetId,
            collection: collectionName,
            action: 'EDIT',
            field: col,
            oldValue: formatSheetValue(oldData[col], col),
            newValue: formatSheetValue(data[col], col)
          };
          await appendToSheet('logs', logData);
        }
      }
    } else {
      // If not found, just append
      await appendToSheet(collectionName, data);
    }
  } catch (err) {
    console.error(`Error updating sheet ${mapping.sheetName}:`, err);
  }
}

// Pre-initialize environment variables from config if possible
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    if (firebaseConfig.projectId) {
      console.log(`Forcing project ID from config: ${firebaseConfig.projectId}`);
      process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
      process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
    }
  } catch (e) {
    console.error('Error pre-reading firebase config:', e);
  }
}

// Initialize Firebase Admin
let db: any;
const SETTINGS_COLLECTION = 'app_settings';
const GOOGLE_TOKENS_DOC = 'google_drive_tokens';

// Local storage fallback if Firestore is completely unavailable
const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'local_storage.json');
function getLocalStorage() {
  if (fs.existsSync(LOCAL_STORAGE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveLocalStorage(data: any) {
  try {
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving local storage:', e);
  }
}

async function initializeFirestore() {
  try {
    const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let configProjectId = undefined;
    let configDbId = undefined;

    if (fs.existsSync(firebaseConfigPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
      configProjectId = firebaseConfig.projectId;
      configDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
        ? firebaseConfig.firestoreDatabaseId 
        : undefined;
      
      // Force environment variables to match config if they are different
      if (configProjectId) {
        if (process.env.GOOGLE_CLOUD_PROJECT !== configProjectId) {
          console.log(`Overriding GOOGLE_CLOUD_PROJECT from ${process.env.GOOGLE_CLOUD_PROJECT} to ${configProjectId}`);
          process.env.GOOGLE_CLOUD_PROJECT = configProjectId;
        }
        if (process.env.GCLOUD_PROJECT !== configProjectId) {
          process.env.GCLOUD_PROJECT = configProjectId;
        }
      }
    }
    
    console.log(`Initializing Firebase Admin. Config Project: ${configProjectId || 'default'}, Database: ${configDbId || '(default)'}`);
    
    // Initialize Firebase Admin - ensure we use the correct project
    if (admin.apps.length > 0) {
      const currentApp = admin.app();
      if (configProjectId && currentApp.options.projectId !== configProjectId) {
        console.log(`Current Firebase App has wrong project ID (${currentApp.options.projectId}). Re-initializing...`);
        await currentApp.delete();
      }
    }

    if (admin.apps.length === 0) {
      console.log('Initializing Firebase Admin...');
      try {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
        
        if (email && rawKey && configProjectId) {
          console.log(`Using service account for Firebase Admin in project: ${configProjectId}`);
          const privateKey = parsePrivateKey(rawKey);
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: configProjectId,
              clientEmail: email,
              privateKey: privateKey,
            }),
            projectId: configProjectId
          });
        } else if (configProjectId) {
          console.log(`Using explicit projectId from config: ${configProjectId}`);
          admin.initializeApp({
            projectId: configProjectId
          });
        } else {
          admin.initializeApp();
          console.log('Firebase Admin initialized with environment defaults.');
        }
      } catch (initErr: any) {
        console.warn('Failed to initialize Firebase Admin with config, trying default:', initErr.message);
        try {
          if (admin.apps.length > 0) await admin.app().delete();
          admin.initializeApp();
        } catch (e) {
          console.error('All Firebase Admin initialization attempts failed.');
        }
      }
    }

    const appInstance = admin.app();
    const actualProjectId = appInstance.options.projectId;
    console.log(`Firebase App Project ID: ${actualProjectId || 'default'}`);

    // Try to initialize Firestore
    const tryConnect = async (targetDbId: string | undefined) => {
      console.log(`Attempting to connect to database: ${targetDbId || '(default)'} in project ${actualProjectId || 'default'}`);
      
      // Use getFirestore from admin app to ensure it uses the app's credentials
      const testDb = targetDbId 
        ? getFirestore(admin.app(), targetDbId)
        : getFirestore(admin.app());
      
      // Test write to verify permissions
      console.log(`Performing test write to database: ${targetDbId || '(default)'}...`);
      await testDb.collection('test_connection').doc('status').set({
        lastChecked: new Date().toISOString(),
        status: 'ok',
        projectId: actualProjectId || 'default',
        databaseId: targetDbId || '(default)'
      });
      return testDb;
    };

    try {
      // 1. Try the configured database first
      db = await tryConnect(configDbId);
      console.log(`Successfully connected to configured database: ${configDbId || '(default)'}`);
    } catch (err: any) {
      console.error(`Failed to connect to configured database: ${err.message}`);
      if (err.message.includes('PERMISSION_DENIED')) {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        console.error(`CRITICAL: Permission denied for Firestore. Please ensure the service account "${email || 'default'}" has the "Cloud Datastore User" role in project "${configProjectId || 'unknown'}".`);
      }
      
      // 2. If configured failed, try the default database in the SAME project
      console.log('Falling back to default database in current project...');
      try {
        db = await tryConnect(undefined);
        console.log('Successfully connected to default database (fallback)');
      } catch (fallbackErr: any) {
        console.error('Default database connection failed:', fallbackErr.message);
        
        // 3. If that also failed, try re-initializing with NO project ID (container default)
        // BUT ONLY if we don't have a configProjectId. If we DO have a configProjectId,
        // we should stick with it and maybe just use local storage for now.
        if (!configProjectId) {
          console.log('Attempting re-initialization with container default project...');
          try {
            if (admin.apps.length > 0) await admin.app().delete();
            admin.initializeApp(); // No args
            const newApp = admin.app();
            db = await tryConnect(undefined);
            console.log(`Successfully connected to container default project: ${newApp.options.projectId}`);
          } catch (finalErr: any) {
            console.error('Container default project connection failed:', finalErr.message);
            db = getFirestore(admin.app());
          }
        } else {
          console.warn(`Sticking with project ${configProjectId} despite errors, as it is explicitly configured.`);
          db = configDbId ? getFirestore(admin.app(), configDbId) : getFirestore(admin.app());
        }
      }
    }
  } catch (error) {
    console.error('Critical error during Firestore initialization:', error);
    if (!admin.apps.length) {
      const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(firebaseConfigPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
        admin.initializeApp({ projectId: firebaseConfig.projectId });
      } else {
        admin.initializeApp();
      }
    }
    db = getFirestore(admin.app());
  }
}

// Call initialization
// initializeFirestore(); // Moved to startServer for better control

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '100mb' }));
app.use(cookieParser());

// API routes FIRST
app.post('/api/sync', async (req, res) => {
  const local = getLocalStorage();
  const results: any = {};
  
  for (const collection of Object.keys(local)) {
    if (!SHEET_MAPPINGS[collection]) continue;
    
    results[collection] = { total: local[collection].length, synced: 0, failed: 0 };
    
    for (const record of local[collection]) {
      try {
        // 1. Sync to Firestore
        if (db) {
          await db.collection(collection).doc(record.id).set(record);
        }
        
        // 2. Sync to Sheets
        // We only append if it's not already there (this is a bit tricky, but for now we just append)
        // Actually, we should probably check if it's already in the sheet, but that's expensive.
        // For now, let's just try to append.
        await appendToSheet(collection, record);
        
        results[collection].synced++;
      } catch (e) {
        console.error(`Sync failed for ${collection}/${record.id}:`, e);
        results[collection].failed++;
      }
    }
  }
  
  res.json({ success: true, results });
});

// Debug Google Sheets connection
app.get('/api/debug/sheets', async (req, res) => {
  try {
    const sheets = getSheetsClient();
    if (!sheets) {
      return res.status(500).json({ error: 'Sheets client not initialized' });
    }
    const rawSpreadsheetId = process.env.GOOGLE_SHEETS_HEMODERIVADOS_ID;
    if (!rawSpreadsheetId) {
      return res.status(500).json({ error: 'GOOGLE_SHEETS_HEMODERIVADOS_ID missing' });
    }

    const spreadsheetId = extractSpreadsheetId(rawSpreadsheetId);
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetNames = response.data.sheets?.map(s => s.properties?.title) || [];
    res.json({
      spreadsheetTitle: response.data.properties?.title,
      availableSheets: sheetNames,
      mappings: Object.keys(SHEET_MAPPINGS).map(k => ({
        collection: k,
        expectedSheet: SHEET_MAPPINGS[k].sheetName,
        found: sheetNames.includes(SHEET_MAPPINGS[k].sheetName)
      }))
    });
  } catch (error: any) {
    console.error('Error debugging sheets:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || 'No extra details'
    });
  }
});

app.get('/api/health', (req, res) => {
  const appInstance = admin.apps.length > 0 ? admin.app() : null;
  res.json({ 
    status: 'ok',
    logs: lastLogs,
    firebase: {
      projectId: appInstance ? appInstance.options.projectId : 'not initialized',
      databaseId: db ? db.databaseId : 'not initialized',
      envProjectId: process.env.GOOGLE_CLOUD_PROJECT,
      envGcloudProject: process.env.GCLOUD_PROJECT,
      appsCount: admin.apps.length,
      dbInitialized: !!db,
      dbProjectId: db ? (db as any).projectId : 'unknown'
    },
    sheets: {
      hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      hasSheetId: !!process.env.GOOGLE_SHEETS_HEMODERIVADOS_ID,
      spreadsheetId: process.env.GOOGLE_SHEETS_HEMODERIVADOS_ID ? `${process.env.GOOGLE_SHEETS_HEMODERIVADOS_ID.substring(0, 5)}...${process.env.GOOGLE_SHEETS_HEMODERIVADOS_ID.substring(process.env.GOOGLE_SHEETS_HEMODERIVADOS_ID.length - 5)}` : 'missing'
    }
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const trimmedUsername = username.trim();
    if (!db) {
      return res.status(500).json({ error: 'La base de datos de Firebase no está sincronizada o inicializada' });
    }

    // Fetch user doc by exact ID first
    let userDocRef = db.collection('users').doc(trimmedUsername);
    let userDocSnap = await userDocRef.get();
    let userData = userDocSnap.exists ? userDocSnap.data() : null;
    let finalUsername = trimmedUsername;

    if (!userDocSnap.exists) {
      // Find case-insensitively by checking doc.id or username field
      const querySnapshot = await db.collection('users').get();
      const matchingDoc = querySnapshot.docs.find(doc => {
        const docId = doc.id.trim().toLowerCase();
        const uName = (doc.data().username || '').trim().toLowerCase();
        return docId === trimmedUsername.toLowerCase() || uName === trimmedUsername.toLowerCase();
      });

      if (matchingDoc) {
        userDocSnap = matchingDoc;
        userData = matchingDoc.data();
        finalUsername = matchingDoc.id;
      } else {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }
    }

    if (!userData) {
      return res.status(500).json({ error: 'Error al consultar los datos del usuario' });
    }

    if (!userData.active) {
      return res.status(403).json({ error: 'El usuario se encuentra inactivo. Comuníquese con soporte de tecnología.' });
    }

    // Verify password matching (trimmed to prevent spaces issues)
    const storedPassword = (userData.password || '').trim();
    const inputPassword = password.trim();
    if (storedPassword !== inputPassword) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Generate a unique clean email for this user in Firebase Auth
    const emailInAuth = `${finalUsername.toLowerCase()}@ucihonda.com.co`;

    console.log(`Syncing Firebase Auth user account for: ${finalUsername} (${emailInAuth})...`);
    let firebaseSyncSuccess = true;
    let firebaseSyncErrorMessage = '';
    try {
      try {
        await admin.auth().getUser(finalUsername);
        await admin.auth().updateUser(finalUsername, {
          email: emailInAuth,
          password: inputPassword,
          displayName: finalUsername,
          disabled: false
        });
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found') {
          console.log(`User ${finalUsername} does not exist in Auth. Creating account...`);
          await admin.auth().createUser({
            uid: finalUsername,
            email: emailInAuth,
            password: inputPassword,
            displayName: finalUsername,
            disabled: false
          });
        } else {
          console.error('Error updating Firebase Auth credentials during synchronization:', authErr);
          throw authErr;
        }
      }
    } catch (syncErr: any) {
      console.warn(`[WARNING] Firebase Auth sync failed (likely Identity Toolkit API is disabled on project). Continuing login anyway:`, syncErr.message);
      firebaseSyncSuccess = false;
      firebaseSyncErrorMessage = syncErr.message || '';
    }

    return res.json({
      success: true,
      firebaseEmail: emailInAuth,
      firebaseSyncSuccess,
      firebaseSyncErrorMessage,
      user: {
        id: finalUsername,
        username: finalUsername,
        email: userData.email,
        role: userData.role,
        active: userData.active,
        permissions: userData.permissions
      }
    });

  } catch (error: any) {
    console.error('Error authenticating user via Express endpoint:', error);
    return res.status(500).json({ error: error.message || 'Error técnico del servidor durante la autenticación' });
  }
});

// Debug Firestore connection
app.get('/api/debug/firestore', async (req, res) => {
  try {
    const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    
    const debugInfo: any = {
      configProjectId: firebaseConfig.projectId,
      configDbId: firebaseConfig.firestoreDatabaseId,
      envProjectId: process.env.GOOGLE_CLOUD_PROJECT,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      apps: admin.apps.map(app => ({ 
        name: app?.name, 
        projectId: app?.options.projectId,
        hasCredential: !!app?.options.credential
      })),
      dbInitialized: !!db,
    };

    if (db) {
      try {
        const collections = await db.listCollections();
        debugInfo.collections = collections.map((c: any) => c.id);
        debugInfo.connectionSuccess = true;
      } catch (e: any) {
        debugInfo.connectionError = e.message;
        debugInfo.connectionErrorCode = e.code;
      }
    }

    res.json(debugInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generic Records API
app.get('/api/records/:collection', async (req, res) => {
  const { collection } = req.params;
  try {
    if (db) {
      try {
        const snapshot = await db.collection(collection).orderBy('createdAt', 'desc').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.json(data);
      } catch (e) {
        console.error(`Firestore fetch failed for ${collection}, using local fallback:`, e);
      }
    }
  } catch (e) {
    console.error(`Error in GET /api/records/${collection}:`, e);
  }
  
  const local = getLocalStorage();
  const data = local[collection] || [];
  res.json(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

// Inventory Closure Endpoint
app.post('/api/inventory/close', async (req, res) => {
  const { items, responsible } = req.body;
  const date = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

  try {
    const sheets = getSheetsClient();
    if (!sheets) throw new Error('Sheets client not initialized');

    const spreadsheetId = extractSpreadsheetId(process.env.GOOGLE_SHEETS_KARDEX_ID || '');
    const sheetName = 'Inventario';

    // Prepare rows
    const rows = items.map((item: any) => [
      date,
      responsible,
      item.name,
      item.category,
      item.batch,
      item.expirationDate,
      item.invimaRecord || 'N/A',
      item.stock,
      item.unit
    ]);

    // Add separator rows
    rows.push(['--', '--', '--', '--', '--', '--', '--', '--', '--']);
    rows.push(['--', '--', '--', '--', '--', '--', '--', '--', '--']);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to close inventory:', error);
    res.status(500).json({ error: 'Failed to close inventory' });
  }
});

app.post('/api/records/:collection', async (req, res) => {
  const { collection } = req.params;
  const { userEmail, ...recordData } = req.body;
  
  const record = { 
    ...recordData, 
    userEmail: userEmail || recordData.userEmail || 'unknown',
    id: recordData.id || Math.random().toString(36).substr(2, 9), 
    createdAt: recordData.createdAt || new Date().toISOString() 
  };
  
  let oldRecord: any = null;
  
  try {
    if (db) {
      try {
        const docRef = db.collection(collection).doc(record.id);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          oldRecord = docSnap.data();
        }
        await docRef.set(record);
      } catch (e) {
        console.error(`Firestore save failed for ${collection}, using local fallback:`, e);
      }
    }
  } catch (e) {
    console.error(`Error in POST /api/records/${collection}:`, e);
  }
  
  // Google Sheets Integration
  if (SHEET_MAPPINGS[collection]) {
    console.log(`Attempting Google Sheets sync for ${collection}...`);
    try {
      // For kardexEntries, we only append (logs), never update
      if (oldRecord && collection !== 'kardexEntries') {
        await updateRowInSheet(collection, record, oldRecord, userEmail || 'unknown');
      } else {
        await appendToSheet(collection, record);
      }
      console.log(`Google Sheets sync successful for ${collection}`);
    } catch (sheetErr) {
      console.error(`Google Sheets sync failed for ${collection}:`, sheetErr);
    }
  }

  // Update status if it's a transfusion or disposition
  if (collection === 'transfusionUse' || collection === 'finalDisposition') {
    const unitId = record.unitId;
    const qualitySeal = record.qualitySeal;
    const status = collection === 'transfusionUse' ? 'Utilizado' : 'Disposición Final';
    
    // Update receivedUnits
    try {
      if (db) {
        const q1 = db.collection('receivedUnits').where('unitId', '==', unitId).get();
        const q2 = db.collection('receivedUnits').where('qualitySeal', '==', qualitySeal).get();
        const [s1, s2] = await Promise.all([q1, q2]);
        const docs = [...s1.docs, ...s2.docs];
        
        for (const doc of docs) {
          const oldUnit = doc.data();
          if (oldUnit.status !== status) {
            const newUnit = { ...oldUnit, status };
            await doc.ref.update({ status });
            await updateRowInSheet('receivedUnits', newUnit, oldUnit, userEmail || 'system');
            
            // Update local storage too
            const local = getLocalStorage();
            if (local.receivedUnits) {
              const idx = local.receivedUnits.findIndex((r: any) => r.id === doc.id);
              if (idx !== -1) {
                local.receivedUnits[idx].status = status;
                saveLocalStorage(local);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to update receivedUnits status:', e);
    }
    
    // Update bloodTestRecords
    try {
      if (db) {
        const q1 = db.collection('bloodTestRecords').where('unitId', '==', unitId).get();
        const q2 = db.collection('bloodTestRecords').where('qualitySeal', '==', qualitySeal).get();
        const [s1, s2] = await Promise.all([q1, q2]);
        const docs = [...s1.docs, ...s2.docs];
        
        for (const doc of docs) {
          const oldTest = doc.data();
          if (oldTest.status !== status) {
            const newTest = { ...oldTest, status };
            await doc.ref.update({ status });
            await updateRowInSheet('bloodTestRecords', newTest, oldTest, userEmail || 'system');

            // Update local storage too
            const local = getLocalStorage();
            if (local.bloodTestRecords) {
              const idx = local.bloodTestRecords.findIndex((r: any) => r.id === doc.id);
              if (idx !== -1) {
                local.bloodTestRecords[idx].status = status;
                saveLocalStorage(local);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to update bloodTestRecords status:', e);
    }
  }
  
  // Always save to local storage as fallback
  const local = getLocalStorage();
  if (!local[collection]) local[collection] = [];
  // Update if exists, else push
  const index = local[collection].findIndex((r: any) => r.id === record.id);
  if (index >= 0) {
    if (!oldRecord) oldRecord = local[collection][index];
    local[collection][index] = record;
  } else {
    local[collection].push(record);
  }
  saveLocalStorage(local);
  
  res.json(record);
});

app.delete('/api/records/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  try {
    if (db) {
      try {
        await db.collection(collection).doc(id).delete();
      } catch (e) {
        console.error(`Firestore delete failed for ${collection}/${id}, using local fallback:`, e);
      }
    }
  } catch (e) {
    console.error(`Error in DELETE /api/records/${collection}/${id}:`, e);
  }
  
  const local = getLocalStorage();
  if (local[collection]) {
    local[collection] = local[collection].filter((r: any) => r.id !== id);
    saveLocalStorage(local);
  }
  
  res.json({ success: true });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    details: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

async function startServer() {
  try {
    // Attempt Firestore initialization but don't crash the server if it fails
    // This allows the server to start and provide feedback to the user
    try {
      await initializeFirestore();
    } catch (firestoreError) {
      console.error('Firestore initialization failed, but starting server anyway:', firestoreError);
    }

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      
      // Explicit fallback for SPA routing in development
      app.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        // Don't intercept API requests or static assets
        if (url.startsWith('/api/') || url.match(/\.(js|css|png|jpg|jpeg|svg|gif|ico|woff|woff2|ttf|eot)$/)) {
          return next();
        }
        
        try {
          let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1); // Exit on fatal error to avoid cyclic restarts if it's a crash loop
  }
}

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
