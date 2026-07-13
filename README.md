# WAHA WhatsApp Control Panel

A beautiful, modern web-based control panel and proxy server to control your WAHA (WhatsApp HTTP API) instance. 

This panel allows you to monitor WhatsApp session lifecycles, scan QR codes directly in the web browser, and execute WhatsApp API requests (sending text, images, videos, audio, documents, locations, contacts, and custom payloads) using a highly intuitive dashboard.

---

## Features
- **Session Manager**: Easily start, stop, or log out of your WhatsApp Web session.
- **Dynamic QR Code Poller**: Automatically pulls and displays the connection QR code when the session is initialized.
- **API Console**: A comprehensive multi-tab API runner supporting:
  - **Text messages**
  - **Images** (local file upload converted to Base64 or public URLs, with captions)
  - **Videos** (local MP4 uploads or public URLs, with captions)
  - **Audio** (local MP3/AAC/OGG/WAV uploads or public URLs)
  - **Documents / Files** (local documents of any type or public URLs, with filename mapping)
  - **Locations** (latitude, longitude, and custom address labels)
  - **Contacts** (vCard sending with names and numbers)
  - **Custom API request editor** (for any custom WAHA endpoints, e.g. poll creation)
- **Response Console**: Real-time logging displaying the exact request payloads and color-coded JSON responses (with HTTP status codes).
- **Settings Panel**: Configures WAHA URL, Web Secret API Keys, and active Session IDs, persisting them to browser `localStorage`.
- **CORS Bypass**: Includes a built-in Node.js Express server acting as a reverse proxy, avoiding any Cross-Origin Resource Sharing (CORS) blocks from the browser.

---

## Prerequisites
1. **Node.js** (v18 or higher) installed on your system.
2. **Docker** installed (to run the WAHA instance).

---

## Installation & Setup

### Step 1: Run the WAHA WhatsApp Instance
Run the WAHA docker container on port `3000`. Open your terminal and run:

**Without API Key:**
```bash
docker run -it -p 3000:3000/tcp devlikeapro/waha
```

**With API Key / Web Secret (Recommended):**
```bash
docker run -it -p 3000:3000/tcp -e WAHA_API_KEY=your_secure_secret devlikeapro/waha
```

### Step 2: Install Panel Dependencies
In the root directory of this project (`Whatsapp-api`), open your terminal and install the Node.js packages:
```bash
npm install
```

### Step 3: Start the Control Panel
Start the proxy and web server:
```bash
npm start
```
By default, the server will start on port `4000`.

---

## How to Use

1. Open your browser and navigate to **`http://localhost:4000`**.
2. Go to the **Settings** page:
   - Enter your WAHA URL (e.g. `http://localhost:3000`).
   - Paste your API Key / Web Secret (if configured in Step 1).
   - Enter your Session ID (defaults to `default`).
   - Click **Save Settings**, then click **Test Connection** to verify.
3. Go to the **Dashboard** page:
   - Click **Start Session**.
   - If a connection is required, a **QR Code** will appear automatically. Scan this QR code using your WhatsApp mobile app under **Linked Devices -> Link a Device**.
   - Once connected, the status will show **WORKING** with a green success message.
4. Go to the **API Console** page:
   - Enter the recipient's phone number in the common input field (in international format without `+`, e.g., `919876543210`).
   - Switch between tabs (Text, Image, Video, etc.) to construct your message.
   - Click **Execute API Request**.
   - Review the sent payload and exact server response on the right-hand **Response Console**.
