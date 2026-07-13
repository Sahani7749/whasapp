const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS
app.use(cors());

// Configure parsing of JSON and urlencoded request bodies with 50MB limit to handle large base64 media uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic Proxy Endpoint to bypass browser CORS
app.post('/api/proxy', async (req, res) => {
  const wahaUrl = req.headers['x-waha-url'];
  const wahaApiKey = req.headers['x-waha-api-key'];
  const wahaEndpoint = req.headers['x-waha-endpoint'];

  if (!wahaUrl) {
    return res.status(400).json({ error: 'Missing x-waha-url header' });
  }
  if (!wahaEndpoint) {
    return res.status(400).json({ error: 'Missing x-waha-endpoint header' });
  }

  // Construct target URL (ensure trailing slash handling is clean)
  const baseUrl = wahaUrl.endsWith('/') ? wahaUrl.slice(0, -1) : wahaUrl;
  const endpointPath = wahaEndpoint.startsWith('/') ? wahaEndpoint : `/${wahaEndpoint}`;
  const targetUrl = `${baseUrl}${endpointPath}`;

  // Prepare headers for WAHA
  const headers = {
    'Content-Type': 'application/json',
  };

  if (wahaApiKey && wahaApiKey.trim() !== '') {
    headers['X-Api-Key'] = wahaApiKey;
  }

  console.log(`[Proxy] Forwarding request to: ${targetUrl} (Method: ${req.body.method || 'POST'})`);

  try {
    const method = req.body.method || 'POST';
    const fetchOptions = {
      method: method,
      headers: headers,
    };

    // If method is not GET or HEAD, attach the body
    if (method !== 'GET' && method !== 'HEAD' && req.body.payload) {
      fetchOptions.body = JSON.stringify(req.body.payload);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');

    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // If it's a binary response (like QR code image), we can read it as buffer and return base64
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      data = {
        _isBinary: true,
        mimetype: contentType || 'image/png',
        data: base64
      };
    }

    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Proxy Error]:', error.message);
    res.status(500).json({
      error: 'Failed to connect to WAHA instance',
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
  console.log(` WAHA WhatsApp Control Panel running on port ${PORT}`);
  console.log(` Open http://localhost:${PORT} in your web browser`);
  console.log(`==================================================`);
});
