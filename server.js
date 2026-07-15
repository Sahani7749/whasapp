const debugLogs = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  debugLogs.push(`[LOG] ${new Date().toISOString()} - ${msg}`);
  if (debugLogs.length > 200) debugLogs.shift();
  originalLog.apply(console, args);
};

console.error = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  debugLogs.push(`[ERR] ${new Date().toISOString()} - ${msg}`);
  if (debugLogs.length > 200) debugLogs.shift();
  originalError.apply(console, args);
};

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS
app.use(cors());

// Configure parsing of JSON and urlencoded request bodies with 50MB limit to handle large base64 media uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Global WhatsApp Connection State
let sock = null;
let sessionStatus = 'STOPPED';
let qrCodeString = null;
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
const WEBHOOK_FILE = path.join(__dirname, 'webhook_config.json');

// Webhook Helpers
function getWebhookConfig() {
  if (fs.existsSync(WEBHOOK_FILE)) {
    try {
      const data = fs.readFileSync(WEBHOOK_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading webhook config:', e);
    }
  }
  return null;
}

function saveWebhookConfig(config) {
  try {
    fs.writeFileSync(WEBHOOK_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing webhook config:', e);
  }
}

function deleteWebhookConfig() {
  try {
    if (fs.existsSync(WEBHOOK_FILE)) {
      fs.unlinkSync(WEBHOOK_FILE);
    }
  } catch (e) {
    console.error('Error deleting webhook config:', e);
  }
}

async function sendWebhook(url, payload) {
  console.log(`[Webhook] Sending payload to ${url}...`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Control-Panel-Webhook'
      },
      body: JSON.stringify(payload)
    });
    console.log(`[Webhook] Sent to ${url}, Response status: ${response.status}`);
  } catch (err) {
    console.error(`[Webhook Error] Failed to send to ${url}:`, err.message);
  }
}

// Initialize WhatsApp connection if credentials already exist (auto-connect on startup)
if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
  console.log('[Baileys] Credentials found. Auto-connecting...');
  connectToWhatsApp();
}

async function connectToWhatsApp() {
  if (sessionStatus === 'WORKING' || sessionStatus === 'STARTING' || sessionStatus === 'SCAN_QR_CODE') {
    console.log('[Baileys] Session is already active or connecting.');
    return;
  }

  sessionStatus = 'STARTING';
  qrCodeString = null;
  console.log('[Baileys] Starting WhatsApp connection...');

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeString = qr;
        sessionStatus = 'SCAN_QR_CODE';
        console.log('[Baileys] New QR Code generated, awaiting scan.');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[Baileys] Connection closed. Reason code: ${statusCode}. Reconnecting: ${shouldReconnect}`);

        sessionStatus = 'STOPPED';
        qrCodeString = null;
        sock = null;

        if (shouldReconnect) {
          connectToWhatsApp();
        }
      } else if (connection === 'open') {
        console.log('[Baileys] Connection successfully opened and working!');
        sessionStatus = 'WORKING';
        qrCodeString = null;
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Listen for incoming messages and trigger Webhook
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          console.log(`[Baileys] New message received from: ${msg.key.remoteJid}`);
          const webhook = getWebhookConfig();
          if (webhook && webhook.url) {
            const senderJid = msg.key.senderPn || msg.key.participant || msg.key.remoteJid;
            const senderNumber = senderJid ? senderJid.split('@')[0] : null;
            const deviceJid = sock?.user?.id;
            const deviceNumber = deviceJid ? deviceJid.split(':')[0].split('@')[0] : null;
            sendWebhook(webhook.url, {
              event: 'message.received',
              session: 'default',
              data: {
                id: msg.key.id,
                from: msg.key.remoteJid,
                fromMe: msg.key.fromMe,
                pushName: msg.pushName || null,
                pushNumber: senderNumber,
                senderNumber: senderNumber,
                senderPn: msg.key.senderPn || null,
                deviceNumber: deviceNumber,
                message: msg.message || null,
                timestamp: msg.messageTimestamp
              }
            });
          }
        }
      }
    });

  } catch (err) {
    console.error('[Baileys] Error starting WhatsApp:', err);
    sessionStatus = 'STOPPED';
    qrCodeString = null;
    sock = null;
  }
}

async function stopSession() {
  if (sock) {
    try {
      sock.end();
    } catch (e) {
      console.log('[Baileys] Error ending socket:', e.message);
    }
    sock = null;
  }
  sessionStatus = 'STOPPED';
  qrCodeString = null;
  console.log('[Baileys] Session stopped.');
}

async function logoutSession() {
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      console.log('[Baileys] Error during socket logout:', e.message);
    }
    sock = null;
  }
  sessionStatus = 'STOPPED';
  qrCodeString = null;

  // Clear credentials
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log('[Baileys] Credentials folder cleared.');
  } catch (err) {
    console.error('[Baileys] Error deleting credentials directory:', err.message);
  }
}

// Helper to convert base64 input or url to Baileys format
function getMediaContent(file) {
  if (!file) return null;
  if (file.data) {
    const base64Data = file.data.split(';base64,').pop();
    return Buffer.from(base64Data, 'base64');
  } else if (file.url) {
    return { url: file.url };
  }
  return null;
}

// Helper to map and sanitize JID
function getJid(chatId) {
  let cleaned = chatId.replace(/[^\d@a-zA-Z.]/g, '');
  if (cleaned.endsWith('@c.us')) {
    return cleaned.replace('@c.us', '@s.whatsapp.net');
  }
  if (!cleaned.includes('@')) {
    return `${cleaned}@s.whatsapp.net`;
  }
  return cleaned;
}

// ==========================================
// REST API ENDPOINTS FOR SESSION MANAGEMENT
// ==========================================

// Get session status
app.get('/api/session/status', (req, res) => {
  res.status(200).json({ status: sessionStatus });
});

// Get session QR Code
app.get('/api/session/qr', (req, res) => {
  if (qrCodeString) {
    res.status(200).json({ value: qrCodeString });
  } else {
    res.status(404).json({ error: 'QR Code not generated yet or session is already linked.' });
  }
});

// Start session
app.post('/api/session/start', async (req, res) => {
  await connectToWhatsApp();
  res.status(200).json({ status: sessionStatus });
});

// Stop session
app.post('/api/session/stop', async (req, res) => {
  await stopSession();
  res.status(200).json({ status: sessionStatus });
});

// Logout session
app.post('/api/session/logout', async (req, res) => {
  await logoutSession();
  res.status(200).json({ status: sessionStatus });
});

// ==========================================
// REST API ENDPOINTS FOR WEBHOOKS
// ==========================================

// Get webhook URL
app.get('/api/webhook', (req, res) => {
  const config = getWebhookConfig();
  if (config) {
    res.status(200).json(config);
  } else {
    res.status(200).json({ url: null });
  }
});

// Save webhook URL
app.post('/api/webhook', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Webhook URL is required' });
  
  saveWebhookConfig({ url });
  res.status(200).json({ success: true, url });
});

// Delete webhook URL
app.delete('/api/webhook', (req, res) => {
  deleteWebhookConfig();
  res.status(200).json({ success: true });
});

// Test webhook endpoint
app.post('/api/webhook/test', async (req, res) => {
  const config = getWebhookConfig();
  if (!config || !config.url) {
    return res.status(400).json({ error: 'No webhook URL registered' });
  }
  
  const testPayload = {
    event: 'webhook.test',
    session: 'default',
    timestamp: Math.floor(Date.now() / 1000),
    data: {
      message: 'This is a test notification from your WhatsApp Control Panel Webhook!',
      status: 'success'
    }
  };
  
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Control-Panel-Webhook'
      },
      body: JSON.stringify(testPayload)
    });
    
    if (response.ok) {
      res.status(200).json({ success: true, details: `Webhook responded with status ${response.status}` });
    } else {
      res.status(502).json({ error: 'Webhook server returned error status', details: `Status code ${response.status}` });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to contact webhook server', details: err.message });
  }
});

// ==========================================
// REST API ENDPOINTS FOR MESSAGING
// ==========================================

// Middleware to verify session is active
const verifySession = (req, res, next) => {
  if (sessionStatus !== 'WORKING') {
    return res.status(400).json({ error: 'WhatsApp session is not active. Please link WhatsApp first.' });
  }
  if (!sock) {
    return res.status(500).json({ error: 'WhatsApp socket is not initialized.' });
  }
  next();
};

// Send Text Message
app.post('/api/send/text', verifySession, async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: 'Missing parameters: to and text are required.' });
    
    const jid = getJid(to);
    const result = await sock.sendMessage(jid, { text });
    res.status(200).json(result);
  } catch (error) {
    console.error('[API sendText Error]:', error);
    res.status(500).json({ error: 'Failed to send text message', details: error.message });
  }
});

// Send Image Message
app.post('/api/send/image', verifySession, async (req, res) => {
  try {
    const { to, file, caption } = req.body;
    if (!to || !file) return res.status(400).json({ error: 'Missing parameters: to and file are required.' });
    
    const jid = getJid(to);
    const media = getMediaContent(file);
    const result = await sock.sendMessage(jid, { image: media, caption });
    res.status(200).json(result);
  } catch (error) {
    console.error('[API sendImage Error]:', error);
    res.status(500).json({ error: 'Failed to send image message', details: error.message });
  }
});

// Send Video Message
app.post('/api/send/video', verifySession, async (req, res) => {
  try {
    const { to, file, caption } = req.body;
    if (!to || !file) return res.status(400).json({ error: 'Missing parameters: to and file are required.' });
    
    const jid = getJid(to);
    const media = getMediaContent(file);
    const result = await sock.sendMessage(jid, { video: media, caption });
    res.status(200).json(result);
  } catch (error) {
    console.error('[API sendVideo Error]:', error);
    res.status(500).json({ error: 'Failed to send video message', details: error.message });
  }
});

// Send Audio Message
app.post('/api/send/audio', verifySession, async (req, res) => {
  try {
    const { to, file } = req.body;
    if (!to || !file) return res.status(400).json({ error: 'Missing parameters: to and file are required.' });
    
    const jid = getJid(to);
    const media = getMediaContent(file);
    const result = await sock.sendMessage(jid, { audio: media, mimetype: file.mimetype || 'audio/mp4' });
    res.status(200).json(result);
  } catch (error) {
    console.error('[API sendAudio Error]:', error);
    res.status(500).json({ error: 'Failed to send audio message', details: error.message });
  }
});

// Send Document Message
app.post('/api/send/document', verifySession, async (req, res) => {
  try {
    const { to, file } = req.body;
    if (!to || !file) return res.status(400).json({ error: 'Missing parameters: to and file are required.' });
    
    const jid = getJid(to);
    const media = getMediaContent(file);
    const result = await sock.sendMessage(jid, { 
      document: media, 
      mimetype: file.mimetype || 'application/octet-stream', 
      fileName: file.filename || 'document' 
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('[API sendDocument Error]:', error);
    res.status(500).json({ error: 'Failed to send document message', details: error.message });
  }
});

// Send Location Message
app.post('/api/send/location', verifySession, async (req, res) => {
  try {
    const { to, latitude, longitude, name } = req.body;
    if (!to || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Missing parameters: to, latitude, and longitude are required.' });
    }
    
    const jid = getJid(to);
    const result = await sock.sendMessage(jid, { 
      location: { 
        degreesLatitude: parseFloat(latitude), 
        degreesLongitude: parseFloat(longitude),
        name: name
      } 
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('[API sendLocation Error]:', error);
    res.status(500).json({ error: 'Failed to send location message', details: error.message });
  }
});

// Send Contact Message
app.post('/api/send/contact', verifySession, async (req, res) => {
  try {
    const { to, contactName, phoneNumber } = req.body;
    if (!to || !contactName || !phoneNumber) {
      return res.status(400).json({ error: 'Missing parameters: to, contactName, and phoneNumber are required.' });
    }
    
    const jid = getJid(to);
    const vcard = 'BEGIN:VCARD\n' +
                  'VERSION:3.0\n' +
                  'FN:' + contactName.trim() + '\n' +
                  'TEL;type=CELL;waid=' + phoneNumber.replace(/[^\d]/g, '') + ':+ ' + phoneNumber.trim() + '\n' +
                  'END:VCARD';
                  
    const result = await sock.sendMessage(jid, { 
      contacts: { 
        displayName: contactName, 
        contacts: [{ vcard }] 
      } 
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('[API sendContact Error]:', error);
    res.status(500).json({ error: 'Failed to send contact message', details: error.message });
  }
});

// Send Sticker Message
app.post('/api/send/sticker', verifySession, async (req, res) => {
  try {
    const { to, file } = req.body;
    if (!to || !file) return res.status(400).json({ error: 'Missing parameters: to and file are required.' });
    
    const jid = getJid(to);
    const media = getMediaContent(file);
    const result = await sock.sendMessage(jid, { sticker: media });
    res.status(200).json(result);
  } catch (error) {
    console.error('[API sendSticker Error]:', error);
    res.status(500).json({ error: 'Failed to send sticker message', details: error.message });
  }
});

// Debug endpoint to capture logs on shared hosting
app.get('/api/debug-logs', (req, res) => {
  let permissionCheck = 'Check failed';
  try {
    const testPath = path.join(__dirname, 'permission_test.txt');
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath);
    permissionCheck = 'WRITE PERMISSION OK';
  } catch (err) {
    permissionCheck = `WRITE PERMISSION ERROR: ${err.message}`;
  }

  res.status(200).json({
    nodeVersion: process.version,
    platform: process.platform,
    port: PORT,
    env: process.env.NODE_ENV || 'production',
    sessionStatus,
    writePermission: permissionCheck,
    logs: debugLogs
  });
});

// Fallback to serve index.html for single page application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Direct Baileys API Server running on port ${PORT}`);
  console.log(` Open http://localhost:${PORT} in your web browser`);
  console.log(`==================================================`);
});
