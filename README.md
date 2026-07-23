# 🛡️ Secure Family Monitor

A privacy-first parental monitoring web application that enables real-time video
streaming from a child's device only after the child explicitly grants camera
permission through their browser's native permission dialog.

## Core Privacy Principles

1. **Camera is NEVER accessed without explicit user action** — the child must
   click "Start Camera" AND approve the browser's native permission prompt
2. **Child has full control** — they can stop sharing at any time with one click
3. **Parent must request access** — the child must approve each viewing session
4. **End-to-end encrypted video** — WebRTC uses DTLS/SRTP by default
5. **No recording or storage** — video streams are never saved on the server
6. **Browser indicators** — the browser's native camera indicator is always visible

## How It Works