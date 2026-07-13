const express = require('express');
const cors = require('cors');
const path = require('path');
const { WahaClient } = require('waha-node');

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS
app.use(cors());

// Configure parsing of JSON and urlencoded request bodies with 50MB limit to handle large base64 media uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic Proxy Endpoint using waha-node library
app.post('/api/proxy', async (req, res) => {
  const wahaUrl = req.headers['x-waha-url'];
  const wahaApiKey = req.headers['x-waha-api-key'];
  const wahaEndpoint = req.headers['x-waha-endpoint'];
  const method = req.body.method || 'POST';
  const payload = req.body.payload;

  if (!wahaUrl) {
    return res.status(400).json({ error: 'Missing x-waha-url header' });
  }
  if (!wahaEndpoint) {
    return res.status(400).json({ error: 'Missing x-waha-endpoint header' });
  }

  console.log(`[Proxy] Forwarding request to WAHA (${wahaUrl}) using waha-node: ${wahaEndpoint} (${method})`);

  try {
    const client = new WahaClient(wahaUrl, wahaApiKey);
    let result;

    // Route endpoints to SDK methods
    if (wahaEndpoint === 'api/sessions' && method === 'GET') {
      result = await client.sessions.list();
    } else if (wahaEndpoint === 'api/sessions' && method === 'POST') {
      result = await client.sessions.create(payload.name);
    } else if (wahaEndpoint.match(/^api\/sessions\/([^\/]+)\/start$/)) {
      const session = wahaEndpoint.split('/')[2];
      result = await client.sessions.start(session);
    } else if (wahaEndpoint.match(/^api\/sessions\/([^\/]+)\/stop$/)) {
      const session = wahaEndpoint.split('/')[2];
      result = await client.sessions.stop(session);
    } else if (wahaEndpoint.match(/^api\/sessions\/([^\/]+)\/logout$/)) {
      const session = wahaEndpoint.split('/')[2];
      result = await client.sessions.logout(session);
    } else if (wahaEndpoint.match(/^api\/([^\/]+)\/auth\/qr$/)) {
      const session = wahaEndpoint.split('/')[1];
      // waha-node's getQr returns the QR code Axios response or binary buffer.
      // Format: 'image' | 'raw', download: true
      const qrRes = await client.sessions.getQr(session, 'image', true);
      result = qrRes;
    } else if (wahaEndpoint === 'api/sendText') {
      result = await client.messages.sendText(payload.session, payload.chatId, payload.text);
    } else if (wahaEndpoint === 'api/sendImage') {
      result = await client.messages.sendImage(payload.session, payload.chatId, payload.file, payload.caption);
    } else if (wahaEndpoint === 'api/sendVideo') {
      result = await client.messages.sendVideo(payload.session, payload.chatId, payload.file, payload.caption);
    } else if (wahaEndpoint === 'api/sendAudio') {
      // Map sendAudio to sendVoice in the SDK
      result = await client.messages.sendVoice(payload.session, payload.chatId, payload.file);
    } else if (wahaEndpoint === 'api/sendFile') {
      result = await client.messages.sendFile(payload.session, payload.chatId, payload.file);
    } else if (wahaEndpoint === 'api/sendLocation') {
      result = await client.messages.sendLocation(payload.session, payload.chatId, {
        latitude: payload.latitude,
        longitude: payload.longitude,
        name: payload.name
      });
    } else if (wahaEndpoint === 'api/sendContactVcard') {
      // Map sendContactVcard to sendContact
      result = await client.messages.sendContact(payload.session, payload.chatId, payload.contact);
    } else {
      // Generic fallback using client prototype HTTP methods (GET, POST, etc.) for custom queries
      if (method === 'GET') {
        result = await client.get(wahaEndpoint);
      } else if (method === 'POST') {
        result = await client.post(wahaEndpoint, payload);
      } else if (method === 'DELETE') {
        result = await client.delete(wahaEndpoint);
      } else if (method === 'PUT') {
        result = await client.put(wahaEndpoint, payload);
      }
    }

    // Return the response data (if Axios response, send result.data, otherwise result)
    const responseData = result && result.data !== undefined ? result.data : result;
    res.status(200).json(responseData);
  } catch (error) {
    console.error('[Proxy Error via SDK]:', error.message);
    const status = error.response ? error.response.status : 500;
    const details = error.response ? error.response.data : error.message;

    res.status(status).json({
      error: 'WAHA SDK Request Failed',
      details: details
    });
  }
});

// Fallback to serve index.html for single page application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` WAHA WhatsApp Control Panel running on port ${PORT}`);
  console.log(` Open http://localhost:${PORT} in your web browser`);
  console.log(`==================================================`);
});
