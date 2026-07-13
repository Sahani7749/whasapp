// Global State
const state = {
  settings: {
    url: 'http://localhost:3000',
    apiKey: '',
    sessionId: 'default'
  },
  activeTab: 'dashboard',
  activeApiTab: 'send-text',
  sessionStatus: 'Unknown',
  isPollingQR: false,
  qrPollInterval: null,
  connectionCheckInterval: null,
  files: {
    image: null,
    video: null,
    audio: null,
    file: null
  }
};

// DOM Elements
const elements = {
  // Navigation
  menuItems: document.querySelectorAll('.menu-item'),
  views: document.querySelectorAll('.tab-view'),
  pageTitle: document.getElementById('page-title'),
  
  // Connection indicators
  connectionPill: document.getElementById('connection-status-pill'),
  connectionText: document.getElementById('connection-status-text'),
  activeSessionName: document.getElementById('active-session-name'),
  
  // Settings view
  settingsSessionId: document.getElementById('settings-session-id'),
  btnSettingsTest: document.getElementById('btn-settings-test'),
  webhookForm: document.getElementById('webhook-form'),
  webhookUrl: document.getElementById('settings-webhook-url'),
  webhookStatusBadge: document.getElementById('webhook-status-badge'),
  btnWebhookTest: document.getElementById('btn-webhook-test'),
  btnWebhookDelete: document.getElementById('btn-webhook-delete'),
  
  // Dashboard view
  dbSessionStatus: document.getElementById('dashboard-session-status'),
  dbWahaUrl: document.getElementById('dashboard-waha-url'),
  dbSessionName: document.getElementById('dashboard-session-name'),
  btnSessionStart: document.getElementById('btn-session-start'),
  btnSessionStop: document.getElementById('btn-session-stop'),
  btnSessionLogout: document.getElementById('btn-session-logout'),
  btnSessionRefresh: document.getElementById('btn-session-refresh'),
  wahaOfflineBanner: document.getElementById('waha-offline-banner'),
  wahaWarningUrl: document.getElementById('waha-warning-url'),
  
  // QR Card states
  qrStatePlaceholder: document.getElementById('qr-state-placeholder'),
  qrStateLoading: document.getElementById('qr-state-loading'),
  qrStateDisplay: document.getElementById('qr-state-display'),
  qrStateConnected: document.getElementById('qr-state-connected'),
  qrCodeImg: document.getElementById('qr-code-img'),
  qrExpiryIndicator: document.getElementById('qr-expiry-indicator'),

  // API Console
  apiTabs: document.querySelectorAll('.form-tab'),
  apiPanels: document.querySelectorAll('.form-panel'),
  apiChatId: document.getElementById('api-chat-id'),
  btnApiSend: document.getElementById('btn-api-send'),
  btnClearLogs: document.getElementById('btn-clear-logs'),
  consoleFeed: document.getElementById('console-feed'),
  
  // Toggle Options
  toggleOptions: document.querySelectorAll('.toggle-option'),
  
  // File pickers
  imageFile: document.getElementById('image-file'),
  videoFile: document.getElementById('video-file'),
  audioFile: document.getElementById('audio-file'),
  fileFile: document.getElementById('file-file'),
  
  // Code inputs
  customPayload: document.getElementById('custom-payload'),
  customEndpoint: document.getElementById('custom-endpoint'),
  customMethod: document.getElementById('custom-method')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupNavigation();
  setupSettingsForm();
  setupWebhookForm();
  loadWebhookSettings();
  updateDocsBaseUrl();
  setupSessionActions();
  setupApiConsole();
  setupFilePickers();
  setupCopyButtons();
  
  // Start checking connection status
  checkConnection(true);
  state.connectionCheckInterval = setInterval(() => checkConnection(false), 8000);
});

// Toast System
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'danger') {
    icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else if (type === 'warning') {
    icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  } else {
    icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      ${icon}
      <span>${message}</span>
    </div>
    <button class="toast-close">&times;</button>
  `;
  
  container.appendChild(toast);
  
  // Close handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });
  
  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.25s ease reverse';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Settings Handlers
function loadSettings() {
  const saved = localStorage.getItem('waha_settings');
  if (saved) {
    try {
      state.settings = JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing saved settings:', e);
    }
  }
  
  // Update Settings Form Fields
  if (elements.settingsSessionId) {
    elements.settingsSessionId.value = state.settings.sessionId;
  }
  
  // Update UI components
  elements.activeSessionName.textContent = state.settings.sessionId;
  elements.dbSessionName.textContent = state.settings.sessionId;
  
  const dbUrl = document.getElementById('dashboard-waha-url');
  if (dbUrl) dbUrl.textContent = window.location.origin;
}

function setupSettingsForm() {
  if (elements.btnSettingsTest) {
    elements.btnSettingsTest.addEventListener('click', async () => {
      showToast('Testing server connection...', 'info');
      const connected = await checkConnection(true);
      if (connected) {
        showToast('Successfully connected to server!', 'success');
      } else {
        showToast('Could not connect to server.', 'danger');
      }
    });
  }
}

// Navigation Handlers
function setupNavigation() {
  elements.menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      
      // Update sidebar state
      elements.menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Toggle Views
      elements.views.forEach(view => {
        if (view.id === `view-${tab}`) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });
      
      // Update Header Title
      state.activeTab = tab;
      elements.pageTitle.textContent = item.innerText.trim();
    });
  });
}

// Core API Proxy Caller (Refactored to map directly to local REST endpoints)
async function callWahaApi(endpoint, payload = null, method = 'POST') {
  let url = '';
  let options = {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  // Map legacy WAHA endpoints to direct Baileys REST API endpoints
  if (endpoint === 'api/sessions' && method === 'GET') {
    url = '/api/session/status';
    options.method = 'GET';
  } else if (endpoint === 'api/sessions' && method === 'POST') {
    url = '/api/session/start';
    options.method = 'POST';
  } else if (endpoint.match(/^api\/sessions\/([^\/]+)\/start$/)) {
    url = '/api/session/start';
    options.method = 'POST';
  } else if (endpoint.match(/^api\/sessions\/([^\/]+)\/stop$/)) {
    url = '/api/session/stop';
    options.method = 'POST';
  } else if (endpoint.match(/^api\/sessions\/([^\/]+)\/logout$/)) {
    url = '/api/session/logout';
    options.method = 'POST';
  } else if (endpoint.match(/^api\/([^\/]+)\/auth\/qr$/)) {
    url = '/api/session/qr';
    options.method = 'GET';
  } 
  
  // Messaging Endpoints Mapping
  else if (endpoint === 'api/sendText') {
    url = '/api/send/text';
    options.body = JSON.stringify({
      to: payload.chatId,
      text: payload.text
    });
  } else if (endpoint === 'api/sendImage') {
    url = '/api/send/image';
    options.body = JSON.stringify({
      to: payload.chatId,
      file: payload.file,
      caption: payload.caption
    });
  } else if (endpoint === 'api/sendVideo') {
    url = '/api/send/video';
    options.body = JSON.stringify({
      to: payload.chatId,
      file: payload.file,
      caption: payload.caption
    });
  } else if (endpoint === 'api/sendAudio') {
    url = '/api/send/audio';
    options.body = JSON.stringify({
      to: payload.chatId,
      file: payload.file
    });
  } else if (endpoint === 'api/sendFile') {
    url = '/api/send/document';
    options.body = JSON.stringify({
      to: payload.chatId,
      file: payload.file
    });
  } else if (endpoint === 'api/sendLocation') {
    url = '/api/send/location';
    options.body = JSON.stringify({
      to: payload.chatId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      name: payload.name
    });
  } else if (endpoint === 'api/sendContactVcard') {
    url = '/api/send/contact';
    options.body = JSON.stringify({
      to: payload.chatId,
      contactName: payload.contact.firstName,
      phoneNumber: payload.contact.phoneNumber
    });
  } else {
    // Custom endpoint fallback
    url = `/${endpoint}`;
    if (payload && method !== 'GET') {
      options.body = JSON.stringify(payload);
    }
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    // Format the response for the legacy UI checkConnection parser
    let formattedData = data;
    if (url === '/api/session/status') {
      formattedData = [
        {
          name: state.settings.sessionId,
          status: data.status
        }
      ];
    }

    return {
      status: response.status,
      data: formattedData
    };
  } catch (error) {
    return {
      status: 500,
      data: { error: 'Request failed', details: error.message }
    };
  }
}

// Format Phone Number
function formatChatId(number) {
  let cleaned = number.replace(/[^\d]/g, '');
  if (cleaned.endsWith('@c.us') || cleaned.endsWith('@g.us')) {
    return cleaned;
  }
  // If it's already structured, return it
  if (number.includes('@')) {
    return number;
  }
  return `${cleaned}@c.us`;
}

// Check Connection & Session Status
async function checkConnection(forceRefreshUi = false) {
  const statusPill = elements.connectionPill;
  const statusText = elements.connectionText;
  
  // Reset pill to connecting
  if (forceRefreshUi) {
    statusPill.className = 'status-pill connecting';
    statusText.textContent = 'Connecting...';
  }

  // Get session status
  // Endpoint to list sessions: GET api/sessions
  const res = await callWahaApi('api/sessions', null, 'GET');
  
  if (res.status === 200 && Array.isArray(res.data)) {
    statusPill.className = 'status-pill online';
    statusText.textContent = 'WAHA Online';
    if (elements.wahaOfflineBanner) {
      elements.wahaOfflineBanner.classList.add('hidden');
    }
    
    // Find our active session
    const activeSession = res.data.find(s => s.name === state.settings.sessionId);
    
    if (activeSession) {
      updateSessionStatusUI(activeSession.status);
    } else {
      updateSessionStatusUI('NOT_FOUND');
    }
    return true;
  } else {
    statusPill.className = 'status-pill offline';
    statusText.textContent = 'WAHA Offline';
    if (elements.wahaOfflineBanner) {
      elements.wahaWarningUrl.textContent = state.settings.url;
      elements.wahaOfflineBanner.classList.remove('hidden');
      
      const isSettingsLocal = state.settings.url.includes('localhost') || state.settings.url.includes('127.0.0.1');
      const isAppRemote = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      
      const warningH = elements.wahaOfflineBanner.querySelector('.warning-content h4');
      const warningP = elements.wahaOfflineBanner.querySelector('.warning-content p');
      const codeBox = elements.wahaOfflineBanner.querySelector('.banner-code-box');
      
      if (isAppRemote && isSettingsLocal) {
        warningH.textContent = 'Localhost URL Configured on Remote Server';
        warningP.innerHTML = `You are hosting this Control Panel on a remote server (<strong>${window.location.hostname}</strong>), but your WAHA URL is pointing to <strong>${state.settings.url}</strong>. The Hostinger server cannot reach your local PC.<br><br><strong>How to fix:</strong><br>1. Expose your local WAHA using ngrok: <code>ngrok http 3000</code><br>2. Copy the public ngrok URL (e.g. <code>https://xxx.ngrok-free.app</code>)<br>3. Paste it in the <strong>Settings</strong> page and save.`;
        if (codeBox) codeBox.classList.add('hidden');
      } else {
        warningH.textContent = 'WAHA Server is Offline';
        warningP.innerHTML = `The control panel cannot reach the WAHA server at <strong>${state.settings.url}</strong>. Please make sure the WAHA Docker container is running by opening your command prompt and executing:`;
        if (codeBox) codeBox.classList.remove('hidden');
      }
    }
    updateSessionStatusUI('STOPPED');
    return false;
  }
}

// Update Session Status UI Elements
function updateSessionStatusUI(status) {
  state.sessionStatus = status;
  elements.dbSessionStatus.textContent = status;
  
  // Remove colors
  elements.dbSessionStatus.className = 'status-highlight';
  
  // Style based on status
  if (status === 'WORKING') {
    elements.dbSessionStatus.classList.add('text-success');
    showQRState('CONNECTED');
    stopQRPolling();
  } else if (status === 'SCAN_QR_CODE') {
    elements.dbSessionStatus.classList.add('text-warning');
    showQRState('DISPLAY');
    startQRPolling();
  } else if (status === 'STARTING') {
    elements.dbSessionStatus.classList.add('text-warning');
    showQRState('LOADING');
    startQRPolling();
  } else if (status === 'STOPPED') {
    elements.dbSessionStatus.classList.add('text-muted');
    showQRState('PLACEHOLDER');
    stopQRPolling();
  } else if (status === 'NOT_FOUND') {
    elements.dbSessionStatus.textContent = 'Not Created';
    elements.dbSessionStatus.classList.add('text-muted');
    showQRState('PLACEHOLDER');
    stopQRPolling();
  } else {
    elements.dbSessionStatus.classList.add('text-muted');
    showQRState('PLACEHOLDER');
    stopQRPolling();
  }
}

// Manage QR Code Display State
function showQRState(qrState) {
  elements.qrStatePlaceholder.classList.add('hidden');
  elements.qrStateLoading.classList.add('hidden');
  elements.qrStateDisplay.classList.add('hidden');
  elements.qrStateConnected.classList.add('hidden');
  
  if (qrState === 'PLACEHOLDER') {
    elements.qrStatePlaceholder.classList.remove('hidden');
  } else if (qrState === 'LOADING') {
    elements.qrStateLoading.classList.remove('hidden');
  } else if (qrState === 'DISPLAY') {
    elements.qrStateDisplay.classList.remove('hidden');
  } else if (qrState === 'CONNECTED') {
    elements.qrStateConnected.classList.remove('hidden');
  }
}

// QR Code Polling
function startQRPolling() {
  if (state.isPollingQR) return;
  state.isPollingQR = true;
  
  const poll = async () => {
    if (!state.isPollingQR) return;
    
    // WAHA QR code endpoint is api/{session}/auth/qr
    const endpoint = `api/${state.settings.sessionId}/auth/qr`;
    const res = await callWahaApi(endpoint, null, 'GET');
    
    if (res.status === 200 && res.data) {
      if (res.data._isBinary && res.data.data) {
        // Our proxy converted the binary QR image to base64
        elements.qrCodeImg.src = `data:${res.data.mimetype};base64,${res.data.data}`;
        elements.qrExpiryIndicator.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        showQRState('DISPLAY');
      } else if (typeof res.data === 'object' && res.data.data) {
        // Some WAHA endpoints return JSON like {"mimetype": "image/png", "data": "..."} when Accept: application/json is sent
        elements.qrCodeImg.src = `data:${res.data.mimetype};base64,${res.data.data}`;
        elements.qrExpiryIndicator.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        showQRState('DISPLAY');
      } else if (res.data.value) {
        // Raw string format
        elements.qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(res.data.value)}`;
        elements.qrExpiryIndicator.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        showQRState('DISPLAY');
      }
    }
  };
  
  poll();
  state.qrPollInterval = setInterval(poll, 6000);
}

function stopQRPolling() {
  state.isPollingQR = false;
  if (state.qrPollInterval) {
    clearInterval(state.qrPollInterval);
    state.qrPollInterval = null;
  }
}

// Session Lifecycle Controls
function setupSessionActions() {
  elements.btnSessionStart.addEventListener('click', async () => {
    showToast('Initializing session start...', 'info');
    
    // Attempting to see if session exists first. If NOT_FOUND, we do POST api/sessions
    // Otherwise we do POST api/sessions/{session}/start
    let endpoint = 'api/sessions';
    let payload = { name: state.settings.sessionId };
    let method = 'POST';
    
    if (state.sessionStatus !== 'NOT_FOUND' && state.sessionStatus !== 'Unknown') {
      endpoint = `api/sessions/${state.settings.sessionId}/start`;
      payload = {};
    }
    
    const res = await callWahaApi(endpoint, payload, method);
    
    logRequestResponse(method, endpoint, payload, res);
    
    if (res.status === 200 || res.status === 201) {
      showToast('Session starting. Please wait...', 'warning');
      checkConnection(true);
    } else {
      showToast(`Error: ${res.data.error || 'Failed to start session'}`, 'danger');
    }
  });

  elements.btnSessionStop.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to STOP this session? This will turn off the WhatsApp engine.')) return;
    
    showToast('Stopping session...', 'info');
    const endpoint = `api/sessions/${state.settings.sessionId}/stop`;
    const res = await callWahaApi(endpoint, {}, 'POST');
    
    logRequestResponse('POST', endpoint, {}, res);
    
    if (res.status === 200 || res.status === 201) {
      showToast('Session stopped.', 'success');
      checkConnection(true);
    } else {
      showToast(`Error: ${res.data.error || 'Failed to stop session'}`, 'danger');
    }
  });

  elements.btnSessionLogout.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to LOGOUT? This will unpair your phone from WAHA and clear session credentials.')) return;
    
    showToast('Logging out...', 'info');
    const endpoint = `api/sessions/${state.settings.sessionId}/logout`;
    const res = await callWahaApi(endpoint, {}, 'POST');
    
    logRequestResponse('POST', endpoint, {}, res);
    
    if (res.status === 200 || res.status === 201) {
      showToast('Session logged out and cleared.', 'success');
      checkConnection(true);
    } else {
      showToast(`Error: ${res.data.error || 'Failed to logout'}`, 'danger');
    }
  });

  elements.btnSessionRefresh.addEventListener('click', () => {
    showToast('Refreshing status...', 'info');
    checkConnection(true);
  });
}

// API Console Handlers
function setupApiConsole() {
  // Tab selector inside Console
  elements.apiTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const apiTab = tab.dataset.apiTab;
      
      elements.apiTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      elements.apiPanels.forEach(panel => {
        if (panel.id === `panel-${apiTab}`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
      
      state.activeApiTab = apiTab;
    });
  });

  // Submit button
  elements.btnApiSend.addEventListener('click', executeApiRequest);
  
  // Clear logs button
  elements.btnClearLogs.addEventListener('click', () => {
    elements.consoleFeed.innerHTML = `
      <div class="console-log-empty">
        <div class="console-placeholder-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
        </div>
        <p>Trigger requests to see exact JSON bodies and responses</p>
      </div>
    `;
  });
}

// Toggle Option handlers (local upload vs URL)
elements.toggleOptions.forEach(opt => {
  opt.addEventListener('click', (e) => {
    const srcToggle = opt.dataset.srcToggle;
    const target = opt.dataset.target;
    
    // Update visual active state
    const container = opt.closest('.toggle-container');
    container.querySelectorAll('.toggle-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    
    // Toggle input field displays
    const localGrp = document.getElementById(`${target}-local-group`);
    const urlGrp = document.getElementById(`${target}-url-group`);
    
    if (srcToggle === 'local') {
      localGrp.classList.remove('hidden');
      urlGrp.classList.add('hidden');
    } else {
      localGrp.classList.add('hidden');
      urlGrp.classList.remove('hidden');
    }
  });
});

// File Pickers Logic (Converts selected files to Base64)
function setupFilePickers() {
  const registerPicker = (fileInputId, dropzoneId, stateField, infoId) => {
    const fileInput = document.getElementById(fileInputId);
    const dropzone = document.getElementById(dropzoneId);
    const info = document.getElementById(infoId);
    
    const handleFile = (file) => {
      if (!file) return;
      
      // Limit file size (WAHA and WhatsApp limitations)
      const sizeMB = file.size / (1024 * 1024);
      const isVideo = file.type.startsWith('video/');
      const limit = isVideo ? 16 : 5; // 16MB for video/audio, 5MB for images
      
      if (sizeMB > limit && fileInputId !== 'file-file') {
        showToast(`File is too large (${sizeMB.toFixed(1)}MB). Max allowed is ${limit}MB.`, 'danger');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        state.files[stateField] = {
          mimetype: file.type || 'application/octet-stream',
          filename: file.name,
          data: e.target.result // Base64 data URL
        };
        
        dropzone.classList.add('has-file');
        dropzone.querySelector('span').textContent = `Selected: ${file.name}`;
        info.textContent = `Size: ${sizeMB.toFixed(2)} MB | Format: ${file.type}`;
        
        // Auto fill document filename
        if (fileInputId === 'file-file') {
          document.getElementById('file-filename').value = file.name;
        }
      };
      
      reader.readAsDataURL(file);
    };

    fileInput.addEventListener('change', (e) => {
      handleFile(e.target.files[0]);
    });

    // Drag-n-drop handlers
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--color-primary)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '';
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      handleFile(files[0]);
    });
  };

  registerPicker('image-file', 'image-local-group', 'image', 'image-file-info');
  registerPicker('video-file', 'video-local-group', 'video', 'video-file-info');
  registerPicker('audio-file', 'audio-local-group', 'audio', 'audio-file-info');
  registerPicker('file-file', 'file-local-group', 'file', 'file-file-info');
}

// Log Feed Renderer inside Console
function logRequestResponse(method, endpoint, payload, response) {
  const feed = elements.consoleFeed;
  
  // Remove placeholder if present
  const empty = feed.querySelector('.console-log-empty');
  if (empty) empty.remove();
  
  const logItem = document.createElement('div');
  const isErr = response.status >= 400 || response.status === 0;
  logItem.className = `log-item ${isErr ? 'log-error' : 'log-success'}`;
  
  const time = new Date().toLocaleTimeString();
  
  // Format json strings for printing
  const payloadStr = payload ? JSON.stringify(payload, null, 2) : '';
  const responseStr = JSON.stringify(response.data, null, 2);
  
  logItem.innerHTML = `
    <div class="log-header">
      <div>
        <span class="log-method">${method}</span>
        <span class="log-endpoint">${endpoint}</span>
      </div>
      <div>
        <span class="log-status status-${response.status}">${response.status}</span>
        <span class="log-time" style="margin-left: 8px;">${time}</span>
      </div>
    </div>
    ${payloadStr ? `<pre class="log-code-block log-payload"><strong>Request Payload:</strong>\n${escapeHtml(payloadStr)}</pre>` : ''}
    <pre class="log-code-block log-response"><strong>Response Body:</strong>\n${escapeHtml(responseStr)}</pre>
  `;
  
  feed.insertBefore(logItem, feed.firstChild);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// Execute Requests of selected api form
async function executeApiRequest() {
  if (state.sessionStatus !== 'WORKING' && state.activeApiTab !== 'send-custom') {
    showToast('Your WhatsApp session is not active. Please start/connect the session first.', 'warning');
  }

  // Get recipient
  const chatIdRaw = elements.apiChatId.value.trim();
  if (!chatIdRaw && state.activeApiTab !== 'send-custom') {
    showToast('Recipient Phone Number is required', 'danger');
    elements.apiChatId.focus();
    return;
  }
  
  const chatId = formatChatId(chatIdRaw);
  const session = state.settings.sessionId;
  
  let endpoint = '';
  let payload = {};
  let method = 'POST';
  
  showToast('Processing request...', 'info');

  switch (state.activeApiTab) {
    case 'send-text':
      endpoint = 'api/sendText';
      const text = document.getElementById('text-message').value.trim();
      if (!text) {
        showToast('Message text is required', 'danger');
        return;
      }
      payload = { chatId, text, session };
      break;

    case 'send-image':
      endpoint = 'api/sendImage';
      const imgType = document.querySelector('input[name="image-src-type"]:checked').value;
      const caption = document.getElementById('image-caption').value.trim();
      
      payload = { chatId, session };
      if (caption) payload.caption = caption;
      
      if (imgType === 'local') {
        if (!state.files.image) {
          showToast('Please select a local image file', 'danger');
          return;
        }
        payload.file = {
          mimetype: state.files.image.mimetype,
          filename: state.files.image.filename,
          data: state.files.image.data
        };
      } else {
        const url = document.getElementById('image-url').value.trim();
        if (!url) {
          showToast('Image URL is required', 'danger');
          return;
        }
        payload.file = { url: url };
      }
      break;

    case 'send-video':
      endpoint = 'api/sendVideo';
      const videoType = document.querySelector('input[name="video-src-type"]:checked').value;
      const videoCaption = document.getElementById('video-caption').value.trim();
      
      payload = { chatId, session };
      if (videoCaption) payload.caption = videoCaption;

      if (videoType === 'local') {
        if (!state.files.video) {
          showToast('Please select a local video file', 'danger');
          return;
        }
        payload.file = {
          mimetype: state.files.video.mimetype,
          filename: state.files.video.filename,
          data: state.files.video.data
        };
      } else {
        const url = document.getElementById('video-url').value.trim();
        if (!url) {
          showToast('Video URL is required', 'danger');
          return;
        }
        payload.file = { url: url };
      }
      break;

    case 'send-audio':
      endpoint = 'api/sendAudio';
      const audioType = document.querySelector('input[name="audio-src-type"]:checked').value;
      
      payload = { chatId, session };

      if (audioType === 'local') {
        if (!state.files.audio) {
          showToast('Please select an audio file', 'danger');
          return;
        }
        payload.file = {
          mimetype: state.files.audio.mimetype,
          filename: state.files.audio.filename,
          data: state.files.audio.data
        };
      } else {
        const url = document.getElementById('audio-url').value.trim();
        if (!url) {
          showToast('Audio URL is required', 'danger');
          return;
        }
        payload.file = { url: url };
      }
      break;

    case 'send-file':
      endpoint = 'api/sendFile';
      const fileType = document.querySelector('input[name="file-src-type"]:checked').value;
      const filename = document.getElementById('file-filename').value.trim();
      
      if (!filename) {
        showToast('Filename is required', 'danger');
        return;
      }
      
      payload = { chatId, session };

      if (fileType === 'local') {
        if (!state.files.file) {
          showToast('Please select a document file', 'danger');
          return;
        }
        payload.file = {
          mimetype: state.files.file.mimetype,
          filename: filename,
          data: state.files.file.data
        };
      } else {
        const url = document.getElementById('file-url').value.trim();
        if (!url) {
          showToast('Document URL is required', 'danger');
          return;
        }
        payload.file = {
          url: url,
          filename: filename
        };
      }
      break;

    case 'send-location':
      endpoint = 'api/sendLocation';
      const lat = parseFloat(document.getElementById('location-lat').value);
      const lng = parseFloat(document.getElementById('location-lng').value);
      const locName = document.getElementById('location-name').value.trim();
      
      if (isNaN(lat) || isNaN(lng)) {
        showToast('Latitude and Longitude must be valid numbers', 'danger');
        return;
      }
      
      payload = {
        chatId,
        session,
        latitude: lat,
        longitude: lng
      };
      if (locName) {
        payload.name = locName;
      }
      break;

    case 'send-contact':
      endpoint = 'api/sendContactVcard';
      const fname = document.getElementById('contact-firstname').value.trim();
      const lname = document.getElementById('contact-lastname').value.trim();
      const phone = document.getElementById('contact-phone').value.trim();
      
      if (!fname || !phone) {
        showToast('Contact First Name and Phone Number are required', 'danger');
        return;
      }
      
      payload = {
        chatId,
        session,
        contact: {
          firstName: fname,
          lastName: lname,
          phoneNumber: phone.replace(/[^\d+]/g, '') // Keep only digits and + sign for contacts
        }
      };
      break;

    case 'send-custom':
      endpoint = elements.customEndpoint.value.trim();
      method = elements.customMethod.value;
      const rawText = elements.customPayload.value.trim();
      
      if (!endpoint) {
        showToast('Custom endpoint is required', 'danger');
        return;
      }
      
      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch (e) {
          showToast('Invalid JSON in Custom Payload', 'danger');
          return;
        }
      } else {
        payload = null;
      }
      break;
  }

  // Trigger proxy call
  const response = await callWahaApi(endpoint, payload, method);
  
  // Output logs
  logRequestResponse(method, endpoint, payload, response);

  if (response.status === 200 || response.status === 201) {
    showToast('API Request sent successfully!', 'success');
  } else {
    showToast(`Error: ${response.data.error || 'Request failed'}`, 'danger');
  }
}

// Copy Code Snippet Handler
function setupCopyButtons() {
  document.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.clipboard;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text:', err);
      });
    });
  });
}

// Webhook Handlers
async function loadWebhookSettings() {
  try {
    const res = await fetch('/api/webhook');
    const data = await res.json();
    if (data && data.url) {
      elements.webhookUrl.value = data.url;
      elements.webhookStatusBadge.className = 'status-pill online';
      elements.webhookStatusBadge.querySelector('span:last-child').textContent = 'Active';
    } else {
      elements.webhookUrl.value = '';
      elements.webhookStatusBadge.className = 'status-pill offline';
      elements.webhookStatusBadge.querySelector('span:last-child').textContent = 'Inactive';
    }
  } catch (e) {
    console.error('Error loading webhook settings:', e);
  }
}

async function saveWebhookSettings(e) {
  if (e) e.preventDefault();
  const url = elements.webhookUrl.value.trim();
  if (!url) return;

  showToast('Saving webhook URL...', 'info');
  try {
    const res = await fetch('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (res.status === 200) {
      showToast('Webhook saved successfully!', 'success');
      loadWebhookSettings();
    } else {
      showToast(`Error: ${data.error || 'Failed to save webhook'}`, 'danger');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'danger');
  }
}

async function testWebhook() {
  showToast('Sending test payload to webhook...', 'info');
  try {
    const res = await fetch('/api/webhook/test', { method: 'POST' });
    const data = await res.json();
    if (res.status === 200) {
      showToast('Test webhook request sent successfully!', 'success');
    } else {
      showToast(`Webhook Test Failed: ${data.details || data.error}`, 'danger');
    }
  } catch (err) {
    showToast(`Test failed: ${err.message}`, 'danger');
  }
}

async function deleteWebhook() {
  if (!confirm('Are you sure you want to delete the registered webhook URL?')) return;
  showToast('Deleting webhook...', 'info');
  try {
    const res = await fetch('/api/webhook', { method: 'DELETE' });
    if (res.status === 200) {
      showToast('Webhook deleted successfully!', 'success');
      loadWebhookSettings();
    } else {
      showToast('Failed to delete webhook', 'danger');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'danger');
  }
}

function setupWebhookForm() {
  if (elements.webhookForm) {
    elements.webhookForm.addEventListener('submit', saveWebhookSettings);
  }
  if (elements.btnWebhookTest) {
    elements.btnWebhookTest.addEventListener('click', testWebhook);
  }
  if (elements.btnWebhookDelete) {
    elements.btnWebhookDelete.addEventListener('click', deleteWebhook);
  }
}

// Dynamically update API documentation base URLs to match current site domain
function updateDocsBaseUrl() {
  const currentOrigin = window.location.origin;
  const baseUrlEl = document.getElementById('docs-base-url');
  if (baseUrlEl) {
    baseUrlEl.textContent = currentOrigin;
  }
  
  // Update curl examples
  const curlTextEl = document.getElementById('example-text-curl');
  if (curlTextEl) {
    curlTextEl.textContent = `curl -X POST ${currentOrigin}/api/send/text \\\n  -H "Content-Type: application/json" \\\n  -d '{"to": "919876543210", "text": "Hello from my CRM!"}'`;
    curlTextEl.parentElement.nextElementSibling.dataset.clipboard = `curl -X POST ${currentOrigin}/api/send/text -H "Content-Type: application/json" -d '{"to": "919876543210", "text": "Hello from my CRM!"}'`;
  }

  const curlImageEl = document.getElementById('example-image-curl');
  if (curlImageEl) {
    curlImageEl.textContent = `curl -X POST ${currentOrigin}/api/send/image \\\n  -H "Content-Type: application/json" \\\n  -d '{"to": "919876543210", "file": {"url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"}, "caption": "Beautiful design!"}'`;
    curlImageEl.parentElement.nextElementSibling.dataset.clipboard = `curl -X POST ${currentOrigin}/api/send/image -H "Content-Type: application/json" -d '{"to": "919876543210", "file": {"url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"}, "caption": "Beautiful design!"}'`;
  }

  const curlVideoEl = document.getElementById('example-video-curl');
  if (curlVideoEl) {
    curlVideoEl.textContent = `curl -X POST ${currentOrigin}/api/send/video \\\n  -H "Content-Type: application/json" \\\n  -d '{"to": "919876543210", "file": {"url": "https://www.w3schools.com/html/mov_bbb.mp4"}, "caption": "Enjoy the video!"}'`;
    curlVideoEl.parentElement.nextElementSibling.dataset.clipboard = `curl -X POST ${currentOrigin}/api/send/video -H "Content-Type: application/json" -d '{"to": "919876543210", "file": {"url": "https://www.w3schools.com/html/mov_bbb.mp4"}, "caption": "Enjoy the video!"}'`;
  }

  // Update PHP & Python templates
  const phpEl = document.getElementById('php-template-box');
  const btnPhp = document.getElementById('btn-copy-php');
  if (phpEl && btnPhp) {
    const code = `<?php
$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => '${currentOrigin}/api/send/text',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS => json_encode([
    'to' => '919876543210',
    'text' => 'Hello from PHP script!'
  ]),
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
]);
$response = curl_exec($curl);
curl_close($curl);
echo $response;
?>`;
    phpEl.textContent = code;
    btnPhp.dataset.clipboard = code;
  }

  const pythonEl = document.getElementById('python-template-box');
  const btnPython = document.getElementById('btn-copy-python');
  if (pythonEl && btnPython) {
    const code = `import requests

url = "${currentOrigin}/api/send/text"
payload = {
    "to": "919876543210",
    "text": "Hello from Python script!"
}
headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
    pythonEl.textContent = code;
    btnPython.dataset.clipboard = code;
  }
}
