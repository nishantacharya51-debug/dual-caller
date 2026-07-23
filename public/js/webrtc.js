/**
 * WebRTC connection manager
 * Handles peer connections with ICE, DTLS/SRTP encryption
 */
class WebRTCManager {
    constructor(socket, encryption) {
        this.socket = socket;
        this.encryption = encryption;
        this.peerConnections = new Map(); // socketId -> RTCPeerConnection
        this.localStream = null;
        this.onRemoteStream = null;
        this.onConnectionStateChange = null;

        // STUN/TURN configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
            // Force encryption
            iceTransportPolicy: 'all',
            // Bundle media for efficiency
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
        };

        this.setupSignalingHandlers();
    }

    /**
     * Request camera access via the standard browser API.
     * This ALWAYS triggers the browser's native permission prompt.
     */
    async requestCameraAccess(constraints = null) {
        const mediaConstraints = constraints || {
            video: {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 24, max: 30 },
                facingMode: 'user',
            },
            audio: false, // Audio disabled for privacy
        };

        try {
            // This triggers the browser's native permission dialog
            // The user MUST explicitly click "Allow"
            // The browser shows its own camera indicator when active
            this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
            return this.localStream;
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw new Error('Camera permission denied by user. This is your right.');
            } else if (err.name === 'NotFoundError') {
                throw new Error('No camera found on this device.');
            } else if (err.name === 'NotReadableError') {
                throw new Error('Camera is in use by another application.');
            } else {
                throw new Error(`Camera error: ${err.message}`);
            }
        }
    }

    /**
     * Stop all camera tracks
     */
    stopCamera() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }
    }

    /**
     * Create peer connection for a remote peer
     */
    createPeerConnection(remoteSocketId) {
        if (this.peerConnections.has(remoteSocketId)) {
            this.closePeerConnection(remoteSocketId);
        }

        const pc = new RTCPeerConnection(this.rtcConfig);

        // Add local stream tracks if available
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc-ice-candidate', {
                    targetSocketId: remoteSocketId,
                    candidate: event.candidate,
                });
            }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
            if (this.onRemoteStream) {
                this.onRemoteStream(event.streams[0], remoteSocketId);
            }
        };

        // Monitor connection state
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`WebRTC connection state (${remoteSocketId}): ${state}`);

            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state, remoteSocketId);
            }

            if (state === 'failed' || state === 'closed') {
                this.closePeerConnection(remoteSocketId);
            }
        };

        // Log ICE connection state for debugging
        pc.oniceconnectionstatechange = () => {
            console.log(`ICE state (${remoteSocketId}): ${pc.iceConnectionState}`);
        };

        this.peerConnections.set(remoteSocketId, pc);
        return pc;
    }

    /**
     * Create and send an offer (called by child/sender)
     */
    async createOffer(remoteSocketId) {
        const pc = this.createPeerConnection(remoteSocketId);

        const offer = await pc.createOffer({
            offerToReceiveVideo: false,
            offerToReceiveAudio: false,
        });

        await pc.setLocalDescription(offer);

        this.socket.emit('webrtc-offer', {
            targetSocketId: remoteSocketId,
            offer: pc.localDescription,
        });
    }

    /**
     * Handle incoming offer and create answer (called by parent/receiver)
     */
    async handleOffer(offer, senderSocketId) {
        const pc = this.createPeerConnection(senderSocketId);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit('webrtc-answer', {
            targetSocketId: senderSocketId,
            answer: pc.localDescription,
        });
    }

    /**
     * Handle incoming answer
     */
    async handleAnswer(answer, senderSocketId) {
        const pc = this.peerConnections.get(senderSocketId);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }

    /**
     * Handle incoming ICE candidate
     */
    async handleIceCandidate(candidate, senderSocketId) {
        const pc = this.peerConnections.get(senderSocketId);
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.warn('Failed to add ICE candidate:', err);
            }
        }
    }

    /**
     * Close a specific peer connection
     */
    closePeerConnection(socketId) {
        const pc = this.peerConnections.get(socketId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(socketId);
        }
    }

    /**
     * Close all peer connections
     */
    closeAllConnections() {
        this.peerConnections.forEach((pc, id) => {
            pc.close();
        });
        this.peerConnections.clear();
    }

    /**
     * Setup socket event handlers for WebRTC signaling
     */
    setupSignalingHandlers() {
        this.socket.on('webrtc-offer', async (data) => {
            try {
                await this.handleOffer(data.offer, data.senderSocketId);
            } catch (err) {
                console.error('Error handling offer:', err);
            }
        });

        this.socket.on('webrtc-answer', async (data) => {
            try {
                await this.handleAnswer(data.answer, data.senderSocketId);
            } catch (err) {
                console.error('Error handling answer:', err);
            }
        });

        this.socket.on('webrtc-ice-candidate', async (data) => {
            try {
                await this.handleIceCandidate(data.candidate, data.senderSocketId);
            } catch (err) {
                console.error('Error handling ICE candidate:', err);
            }
        });
    }

    /**
     * Get connection statistics
     */
    async getStats(socketId) {
        const pc = this.peerConnections.get(socketId);
        if (!pc) return null;

        const stats = await pc.getStats();
        const result = {};

        stats.forEach(report => {
            if (report.type === 'transport') {
                result.dtlsState = report.dtlsState;
                result.selectedCandidatePairChanges = report.selectedCandidatePairChanges;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                result.roundTripTime = report.currentRoundTripTime;
                result.bytesSent = report.bytesSent;
                result.bytesReceived = report.bytesReceived;
            }
        });

        return result;
    }
}

window.WebRTCManager = WebRTCManager;