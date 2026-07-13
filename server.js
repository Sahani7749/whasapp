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

// Initialize WhatsApp connection if credentials already exist (auto-connect on startup)
if (fs.existsSync(path.join(__dirname, 'auth_info_baileys', 'creds.json'))) {
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
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

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
    fs.rmSync(path.join(__dirname, 'auth_info_baileys'), { recursive: true, force: true });
    console.log('[Baileys] Credentials folder cleared.');
  } catch (err) {
    console.error('[Baileys] Error deleting credentials directory:', err.message);
  }
}

// Helper to convert base64 input or url to Baileys format
function getMediaContent(file) {
  if (!file) return null;
  if (file.data) {
    // Base64 format: data:image/jpeg;base64,iVBORw0KGgoAAA...
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

// Local API handler replacing the WAHA proxy
app.post('/api/proxy', async (req, res) => {
  const wahaEndpoint = req.headers['x-waha-endpoint'];
  const method = req.body.method || 'POST';
  const payload = req.body.payload;

  if (!wahaEndpoint) {
    return res.status(400).json({ error: 'Missing x-waha-endpoint header' });
  }

  console.log(`[API Handler] Executing direct Baileys action for: ${wahaEndpoint}`);

  try {
    let result = null;

    // 1. Session management routes
    if (wahaEndpoint === 'api/sessions' && method === 'GET') {
      result = [
        {
          name: 'default',
          status: sessionStatus
        }
      ];
    } else if (wahaEndpoint === 'api/sessions' && method === 'POST') {
      await connectToWhatsApp();
      result = { status: sessionStatus };
    } else if (wahaEndpoint.match(/^api\/sessions\/([^\/]+)\/start$/)) {
      await connectToWhatsApp();
      result = { status: sessionStatus };
    } else if (wahaEndpoint.match(/^api\/sessions\/([^\/]+)\/stop$/)) {
      await stopSession();
      result = { status: sessionStatus };
    } else if (wahaEndpoint.match(/^api\/sessions\/([^\/]+)\/logout$/)) {
      await logoutSession();
      result = { status: sessionStatus };
    } else if (wahaEndpoint.match(/^api\/([^\/]+)\/auth\/qr$/)) {
      if (qrCodeString) {
        result = { value: qrCodeString };
      } else {
        result = { error: 'QR Code not generated yet. Ensure session status is SCAN_QR_CODE.' };
      }
    } 
    // 2. Messaging routes (require active connection)
    else {
      if (sessionStatus !== 'WORKING') {
        return res.status(400).json({ error: 'WhatsApp session is not active. Please link WhatsApp first.' });
      }
      if (!sock) {
        return res.status(500).json({ error: 'WhatsApp socket is not initialized.' });
      }

      const jid = getJid(payload.chatId);

      if (wahaEndpoint === 'api/sendText') {
        result = await sock.sendMessage(jid, { text: payload.text });
      } else if (wahaEndpoint === 'api/sendImage') {
        const media = getMediaContent(payload.file);
        result = await sock.sendMessage(jid, { image: media, caption: payload.caption });
      } else if (wahaEndpoint === 'api/sendVideo') {
        const media = getMediaContent(payload.file);
        result = await sock.sendMessage(jid, { video: media, caption: payload.caption });
      } else if (wahaEndpoint === 'api/sendAudio') {
        const media = getMediaContent(payload.file);
        result = await sock.sendMessage(jid, { audio: media, mimetype: payload.file.mimetype || 'audio/mp4' });
      } else if (wahaEndpoint === 'api/sendFile') {
        const media = getMediaContent(payload.file);
        result = await sock.sendMessage(jid, { document: media, mimetype: payload.file.mimetype || 'application/octet-stream', fileName: payload.file.filename });
      } else if (wahaEndpoint === 'api/sendLocation') {
        result = await sock.sendMessage(jid, {
          location: {
            degreesLatitude: payload.latitude,
            degreesLongitude: payload.longitude
          }
        });
      } else if (wahaEndpoint === 'api/sendContactVcard') {
        const contactName = (payload.contact.firstName + ' ' + (payload.contact.lastName || '')).trim();
        const vcard = 'BEGIN:VCARD\n' +
                      'VERSION:3.0\n' +
                      'FN:' + contactName + '\n' +
                      'TEL;type=CELL;waid=' + payload.contact.phoneNumber + ':+ ' + payload.contact.phoneNumber + '\n' +
                      'END:VCARD';
        result = await sock.sendMessage(jid, { 
          contacts: { 
            displayName: payload.contact.firstName, 
            contacts: [{ vcard }] 
          } 
        });
      } else {
        return res.status(404).json({ error: `Method ${wahaEndpoint} not supported in direct mode` });
      }
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('[API Error]:', error);
    res.status(500).json({
      error: 'WhatsApp Connection Request Failed',
      details: error.message
    });
  }
});

// Fallback to serve index.html for single page application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Direct WhatsApp Control Panel running on port ${PORT}`);
  console.log(` Open http://localhost:${PORT} in your web browser`);
  console.log(`==================================================`);
});
