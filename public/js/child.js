(function () {
    'use strict';

    // Auth check
    const token = sessionStorage.getItem('authToken');
    const userData = sessionStorage.getItem('userData');

    if (!token || !userData) {
        window.location.href = '/';
        return;
    }

    const user = JSON.parse(userData);

    if (user.role !== 'child') {
        window.location.href = '/';
        return;
    }

    // DOM Elements
    const usernameDisplay = document.getElementById('username-display');
    const familyCodeDisplay = document.getElementById('family-code-display');
    const connectionStatus = document.getElementById('connection-status');
    const cameraStatus = document.getElementById('camera-status');
    const cameraActiveBanner = document.getElementById('camera-active-banner');
    const startCameraBtn = document.getElementById('start-camera-btn');
    const stopCameraBtn = document.getElementById('stop-camera-btn');
    const emergencyStopBtn = document.getElementById('emergency-stop');
    const localVideo = document.getElementById('local-video');
    const videoPlaceholder = document.getElementById('video-placeholder');
    const recordingIndicator = document.getElementById('recording-indicator');
    const parentRequests = document.getElementById('parent-requests');
    const requestsList = document.getElementById('requests-list');
    const familyMembers = document.getElementById('family-members');
    const activityLog = document.getElementById('activity-log');
    const logoutBtn = document.getElementById('logout-btn');

    // Display user info
    usernameDisplay.textContent = `👤 ${user.username}`;
    familyCodeDisplay.textContent = `👨‍👩‍👧 ${user.familyCode}`;

    // State
    let cameraActive = false;
    let isStreaming = false;
    let activeParentSocket = null;

    // Initialize encryption
    const encryption = new E2EEncryption();

    // Initialize Socket.IO
    const socket = io({
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
    });

    // Initialize WebRTC
    const webrtc = new WebRTCManager(socket, encryption);

    // --- Socket Events ---

    socket.on('connect', () => {
        updateConnectionStatus(true);
        addLog('Connected to server securely');
    });

    socket.on('disconnect', (reason) => {
        updateConnectionStatus(false);
        addLog(`Disconnected: ${reason}`);
    });

    socket.on('connect_error', (err) => {
        addLog(`Connection error: ${err.message}`);
        if (err.message === 'Authentication required' || err.message === 'Invalid authentication token') {
            sessionStorage.clear();
            window.location.href = '/';
        }
    });

    socket.on('family-status', (data) => {
        updateFamilyMembers(data);
        addLog(`Family status updated: ${data.parents.length} parent(s), ${data.children.length} child(ren) online`);
    });

    socket.on('family-member-connected', (data) => {
        addLog(`${data.username} (${data.role}) connected`);
    });

    socket.on('family-member-disconnected', (data) => {
        addLog(`${data.username} (${data.role}) disconnected`);

        // If the viewing parent disconnected, we can note it
        if (data.role === 'parent' && isStreaming) {
            addLog('Parent viewer disconnected. You can stop your camera if you wish.');
        }
    });

    socket.on('parent-requests-camera', (data) => {
        addLog(`${data.parentUsername} is requesting to view your camera`);
        showParentRequest(data);
    });

    socket.on('error-message', (data) => {
        addLog(`Error: ${data.error}`);
    });

    // --- Camera Controls ---

    startCameraBtn.addEventListener('click', async () => {
        if (cameraActive) return;

        addLog('Requesting camera access... (Browser will ask for your permission)');
        startCameraBtn.disabled = true;
        startCameraBtn.innerHTML = '<span class="spinner"></span> Requesting permission...';

        try {
            const stream = await webrtc.requestCameraAccess();

            // Camera access granted by user through browser prompt
            cameraActive = true;
            localVideo.srcObject = stream;
            videoPlaceholder.hidden = true;
            recordingIndicator.hidden = false;
            cameraActiveBanner.hidden = false;
            stopCameraBtn.disabled = false;
            startCameraBtn.innerHTML = '📷 Camera Active';

            updateCameraStatus(true);
            addLog('✅ Camera started - You granted browser permission');

            // Notify server that camera is available
            socket.emit('camera-permission-granted', {
                childId: user.id,
            });

        } catch (err) {
            addLog(`❌ ${err.message}`);
            startCameraBtn.disabled = false;
            startCameraBtn.innerHTML = '📷 Start Camera';
        }
    });

    stopCameraBtn.addEventListener('click', () => {
        stopCamera();
    });

    emergencyStopBtn.addEventListener('click', () => {
        stopCamera();
        addLog('🛑 Emergency stop - Camera turned off immediately');
    });

    function stopCamera() {
        webrtc.stopCamera();
        webrtc.closeAllConnections();

        cameraActive = false;
        isStreaming = false;
        activeParentSocket = null;

        localVideo.srcObject = null;
        videoPlaceholder.hidden = false;
        recordingIndicator.hidden = true;
        cameraActiveBanner.hidden = true;
        startCameraBtn.disabled = false;
        startCameraBtn.innerHTML = '📷 Start Camera';
        stopCameraBtn.disabled = true;

        updateCameraStatus(false);
        addLog('Camera stopped - No one can see you');

        // Notify server
        socket.emit('camera-permission-revoked');
    }

    // --- Parent Request Handling ---

    function showParentRequest(data) {
        parentRequests.hidden = false;

        const requestCard = document.createElement('div');
        requestCard.className = 'request-card';
        requestCard.id = `request-${data.parentSocketId}`;
        requestCard.innerHTML = `
            <div>
                <strong>${data.parentUsername}</strong> wants to view your camera
                <br><small class="muted">You can deny this request</small>
            </div>
            <div class="request-actions">
                <button class="btn btn-success btn-small approve-btn" 
                        ${!cameraActive ? 'disabled title="Start camera first"' : ''}>
                    ✅ Allow
                </button>
                <button class="btn btn-danger btn-small deny-btn">
                    ❌ Deny
                </button>
            </div>
        `;

        const approveBtn = requestCard.querySelector('.approve-btn');
        const denyBtn = requestCard.querySelector('.deny-btn');

        approveBtn.addEventListener('click', async () => {
            if (!cameraActive) {
                addLog('Please start your camera before approving');
                return;
            }

            addLog(`Approved ${data.parentUsername}'s request - Starting video stream`);

            socket.emit('approve-camera-request', {
                parentSocketId: data.parentSocketId,
                approved: true,
            });

            // Start WebRTC connection to parent
            activeParentSocket = data.parentSocketId;
            isStreaming = true;

            try {
                await webrtc.createOffer(data.parentSocketId);
                addLog('🔒 Encrypted video stream started (WebRTC DTLS/SRTP)');
            } catch (err) {
                addLog(`Error starting stream: ${err.message}`);
            }

            requestCard.remove();
            if (requestsList.children.length === 0) {
                parentRequests.hidden = true;
            }
        });

        denyBtn.addEventListener('click', () => {
            addLog(`Denied ${data.parentUsername}'s request`);

            socket.emit('approve-camera-request', {
                parentSocketId: data.parentSocketId,
                approved: false,
            });

            requestCard.remove();
            if (requestsList.children.length === 0) {
                parentRequests.hidden = true;
            }
        });

        requestsList.appendChild(requestCard);
    }

    // --- UI Update Functions ---

    function updateConnectionStatus(connected) {
        const dot = connectionStatus.querySelector('.status-dot');
        const text = connectionStatus.querySelector('.status-text');

        if (connected) {
            dot.className = 'status-dot connected';
            text.textContent = 'Connected';
        } else {
            dot.className = 'status-dot disconnected';
            text.textContent = 'Disconnected';
        }
    }

    function updateCameraStatus(active) {
        const text = cameraStatus.querySelector('.status-text');
        const icon = cameraStatus.querySelector('.camera-icon');

        if (active) {
            text.textContent = 'Camera On';
            icon.textContent = '🔴';
            cameraStatus.style.color = 'var(--danger)';
        } else {
            text.textContent = 'Camera Off';
            icon.textContent = '📷';
            cameraStatus.style.color = '';
        }
    }

    function updateFamilyMembers(data) {
        familyMembers.innerHTML = '';

        if (data.parents.length === 0 && data.children.length <= 1) {
            familyMembers.innerHTML = '<p class="muted">No other family members connected</p>';
            return;
        }

        data.parents.forEach(parent => {
            const card = document.createElement('div');
            card.className = 'member-card';
            card.innerHTML = `
                <span>${parent.username}</span>
                <span class="member-role parent">Parent</span>
            `;
            familyMembers.appendChild(card);
        });

        data.children
            .filter(child => child.userId !== user.id)
            .forEach(child => {
                const card = document.createElement('div');
                card.className = 'member-card';
                card.innerHTML = `
                    <span>${child.username}</span>
                    <span class="member-role child">Child</span>
                `;
                familyMembers.appendChild(card);
            });
    }

    function addLog(message) {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-message">${message}</span>
        `;

        activityLog.appendChild(entry);
        activityLog.scrollTop = activityLog.scrollHeight;

        // Keep only last 100 entries
        while (activityLog.children.length > 100) {
            activityLog.removeChild(activityLog.firstChild);
        }
    }

    // --- Logout ---

    logoutBtn.addEventListener('click', () => {
        stopCamera();
        socket.disconnect();
        sessionStorage.clear();
        window.location.href = '/';
    });

    // --- Page Visibility ---
    // Warn if page is hidden while camera is active
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && cameraActive) {
            addLog('⚠️ Page hidden - Camera is still active');
        }
    });

    // --- Cleanup on page unload ---
    window.addEventListener('beforeunload', () => {
        stopCamera();
        socket.disconnect();
    });

    // Clear initial log
    activityLog.innerHTML = '';
    addLog('Child dashboard loaded. Ready to connect.');
})();