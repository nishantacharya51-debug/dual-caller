/**
 * Client-side encryption utilities using the Web Crypto API.
 * WebRTC already provides DTLS/SRTP encryption for media streams.
 * This module adds an extra encryption layer for signaling metadata.
 */
class E2EEncryption {
    constructor() {
        this.keyPair = null;
        this.sharedKeys = new Map(); // peerId -> CryptoKey
    }

    /**
     * Generate ECDH key pair for key exchange
     */
    async generateKeyPair() {
        this.keyPair = await window.crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey']
        );
        return this.keyPair;
    }

    /**
     * Export public key for sharing with peer
     */
    async exportPublicKey() {
        if (!this.keyPair) await this.generateKeyPair();
        const exported = await window.crypto.subtle.exportKey('raw', this.keyPair.publicKey);
        return this.arrayBufferToBase64(exported);
    }

    /**
     * Import a peer's public key and derive shared secret
     */
    async deriveSharedKey(peerPublicKeyBase64, peerId) {
        const peerKeyBuffer = this.base64ToArrayBuffer(peerPublicKeyBase64);
        const peerPublicKey = await window.crypto.subtle.importKey(
            'raw',
            peerKeyBuffer,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );

        const sharedKey = await window.crypto.subtle.deriveKey(
            { name: 'ECDH', public: peerPublicKey },
            this.keyPair.privateKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        this.sharedKeys.set(peerId, sharedKey);
        return sharedKey;
    }

    /**
     * Encrypt data with shared key
     */
    async encrypt(data, peerId) {
        const key = this.sharedKeys.get(peerId);
        if (!key) throw new Error('No shared key for peer: ' + peerId);

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedData = new TextEncoder().encode(JSON.stringify(data));

        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encodedData
        );

        return {
            iv: this.arrayBufferToBase64(iv),
            data: this.arrayBufferToBase64(encrypted),
        };
    }

    /**
     * Decrypt data with shared key
     */
    async decrypt(encryptedPayload, peerId) {
        const key = this.sharedKeys.get(peerId);
        if (!key) throw new Error('No shared key for peer: ' + peerId);

        const iv = this.base64ToArrayBuffer(encryptedPayload.iv);
        const data = this.base64ToArrayBuffer(encryptedPayload.data);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        return JSON.parse(new TextDecoder().decode(decrypted));
    }

    // Utility methods
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// Make globally available
window.E2EEncryption = E2EEncryption;