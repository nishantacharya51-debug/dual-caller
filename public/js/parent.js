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

    if (user.role !== 'parent') {
        window.location.href = '/';
        return;
    }

    // DOM Elements
    const usernameDisplay = document.getElementById('username-display');
    const familyCodeDisplay = document.getElementById('family-code-display');
    const familyCodeValue = document.getElementById('family-code-value');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const connectionStatus = document.getElementById('connection-status');
    const childrenList = document.getElementById('children-list');
    const remoteVideo = document.getElementById('remote-video');
    const videoPlaceholder = document.getElementById('video-placeholder');
    const streamInfo = document.getElementById('stream-info');
    const streamChildName = document.getElementById('stream-child-name');
    const activityLog = document.getElementById('activity-log');
    const logoutBtn = document.getElementById('logout-btn');

    // Display user info
    usernameDisplay.textContent = `👤 ${user.username}`;
    familyCodeDisplay.textContent = `👨‍👩‍👧 ${user.familyCode}`;
    familyCodeValue.textContent = user.familyCode;

    // State
    let connectedChildren = new Map(); // userId -> child data
    let availableCameras = new Map(); // socketId -> child data

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

    // Set up remote stream handler
    webrtc.onRemoteStream = (stream, socketId) => {
        remoteVideo.srcObject = stream;
        videoPlaceholder.hidden = true;
        streamInfo.hidden = false;

        const childData = availableCameras.get(socketId);
        if (childData) {
            streamChildName.textContent = childData.childUsername;
        }

        addLog('🔒 Receiving encrypted video stream (WebRTC DTLS/SRTP)');
    };

    webrtc.onConnectionStateChange = (state, socketId) => {
        addLog(`Stream connection: ${state}`);

        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            remoteVideo.srcObject = null;
            videoPlaceholder.hidden = false;
            streamInfo.hidden = true;
            addLog('Video stream ended');
        }
    };

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
        updateChildrenList(data);
        addLog(`Family: ${data.parents.length} parent(s), ${data.children.length} child(ren) online`);
    });

    socket.on('family-member-connected', (data) => {
        addLog(`${data.username} (${data.role}) connected`);
    });

    socket.on('family-member-disconnected', (data) => {
        addLog(`${data.username} (${data.role}) disconnected`);

        if (data.role === 'child') {
            // Remove from available cameras
            for (const [socketId, childData] of availableCameras.entries()) {
                if (childData.childId === data.userId) {
                    availableCameras.delete(socketId);
                    break;
                }
            }
            updateChildrenListUI();

            // Check if currently streaming child disconnected
            if (remoteVideo.srcObject) {
                remoteVideo.srcObject = null;
                videoPlaceholder.hidden = false;
                streamInfo.hidden = true;
                addLog('Streaming child disconnected - Video ended');
            }
        }
    });

    socket.on('child-camera-available', (data) => {
        availableCameras.set(data.childSocketId, data);
        addLog(`📷 ${data.childUsername}'s camera is now available`);
        updateChildrenListUI();
    });

    socket.on('child-camera-unavailable', (data) => {
        for (const [socketId, childData] of availableCameras.entries()) {
            if (childData.childId === data.childId) {
                availableCameras.delete(socketId);
                break;
            }
        }
        addLog(`${data.childUsername} turned off their camera`);
        updateChildrenListUI();

        // Stop video if this child was streaming
        if (remoteVideo.srcObject) {
            remoteVideo.srcObject = null;
            videoPlaceholder.hidden = false;
            streamInfo.hidden = true;
        }
    });

    socket.on('camera-request-response', (data) => {
        if (data.approved) {
            addLog(`✅ ${data.childUsername} approved your camera request`);
            addLog('Waiting for encrypted video stream...');
        } else {
            addLog(`❌ ${data.childUsername} denied your camera request. This is their right.`);
        }
    });

    socket.on('error-message', (data) => {
        addLog(`Error: ${data.error}`);
    });

    // --- Copy Family Code ---

    copyCodeBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(user.familyCode);
            copyCodeBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyCodeBtn.textContent = '📋 Copy';
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = user.familyCode;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            copyCodeBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyCodeBtn.textContent = '📋 Copy';
            }, 2000);
        }
    });

    // --- Children List Management ---

    function updateChildrenList(data) {
        connectedChildren.clear();
        data.children.forEach(child => {
            connectedChildren.set(child.userId, child);
        });
        updateChildrenListUI();
    }

    function updateChildrenListUI() {
        childrenList.innerHTML = '';

        if (connectedChildren.size === 0) {
            childrenList.innerHTML = `
                <p class="muted">No children connected. Share your family code: 
                <strong>${user.familyCode}</strong></p>
            `;
            return;
        }

        connectedChildren.forEach((child) => {
            const card = document.createElement('div');
            card.className = 'child-card';

            // Check if camera is available
            let cameraAvailable = false;
            let childSocketId = null;

            for (const [socketId, camData] of availableCameras.entries()) {
                if (camData.childId === child.userId) {
                    cameraAvailable = true;
                    childSocketId = socketId;
                    break;
                }
            }

            card.innerHTML = `
                <div>
                    <strong>${child.username}</strong>
                    <span class="member-role child">Child</span>
                    ${cameraAvailable ? '<span class="camera-available-badge">📷 Camera Available</span>' : ''}
                </div>
                <div>
                    ${cameraAvailable
                        ? `<button class="btn btn-primary btn-small request-camera-btn" 
                                   data-socket-id="${childSocketId}">
                               👁️ Request to View
                           </button>`
                        : '<span class="muted small">Camera off</span>'
                    }
                </div>
            `;

            const requestBtn = card.querySelector('.request-camera-btn');
            if (requestBtn) {
                requestBtn.addEventListener('click', () => {
                    requestCameraView(childSocketId);
                    requestBtn.disabled = true;
                    requestBtn.textContent = '⏳ Waiting for approval...';
                });
            }

            childrenList.appendChild(card);
        });
    }

    function requestCameraView(childSocketId) {
        addLog('Requesting camera access from child (they must approve)...');
        socket.emit('request-view-camera', {
            childSocketId: childSocketId,
        });
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

        while (activityLog.children.length > 100) {
            activityLog.removeChild(activityLog.firstChild);
        }
    }

    // --- Logout ---

    logoutBtn.addEventListener('click', () => {
        webrtc.closeAllConnections();
        socket.disconnect();
        sessionStorage.clear();
        window.location.href = '/';
    });

    // --- Cleanup ---
    window.addEventListener('beforeunload', () => {
        webrtc.closeAllConnections();
        socket.disconnect();
    });

    // Clear initial log
    activityLog.innerHTML = '';
    addLog('Parent dashboard loaded. Waiting for children to connect.');
})();