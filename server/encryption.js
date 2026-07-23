// Server-side encryption utilities for metadata
// The actual video stream is encrypted end-to-end via WebRTC DTLS/SRTP
const crypto = require('crypto');

class ServerEncryption {
  static generateKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }

  static encryptMetadata(data, publicKey) {
    const buffer = Buffer.from(JSON.stringify(data));
    const encrypted = crypto.publicEncrypt(publicKey, buffer);
    return encrypted.toString('base64');
  }

  static decryptMetadata(encryptedData, privateKey) {
    const buffer = Buffer.from(encryptedData, 'base64');
    const decrypted = crypto.privateDecrypt(privateKey, buffer);
    return JSON.parse(decrypted.toString());
  }

  static hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

module.exports = ServerEncryption;