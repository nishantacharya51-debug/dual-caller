/* Test doubles: a small in-process simulation of PeerJS signaling + WebRTC,
   so the real app code can be driven end-to-end from Node (jsdom). */
import { readFileSync } from 'node:fs';

export function appScript(file = 'index.html') {
  const html = readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) throw new Error('no inline script found in ' + file);
  return blocks[blocks.length - 1][1];
}

class Emitter {
  constructor() { this._e = {}; }
  on(t, f) { (this._e[t] = this._e[t] || []).push(f); return this; }
  once(t, f) { const w = (...a) => { this.off(t, w); f(...a); }; return this.on(t, w); }
  off(t, f) { if (this._e[t]) this._e[t] = this._e[t].filter(x => x !== f); }
  emit(t, ...a) { (this._e[t] || []).slice().forEach(f => { try { f(...a); } catch (e) { console.error('[fake emit]', t, e && e.message); } }); }
}

export function createBus(opts = {}) {
  const bus = {
    peers: new Map(),
    links: new Map(),
    workingRelays: opts.workingRelays || ['ExpressTURN 1', 'OpenRelay 443'],
    failNextMedia: opts.failNextMedia || 0,
    mediaFailSticky: !!opts.mediaFailSticky,
    relayUsed: false,
    noDisplayMedia: !!opts.noDisplayMedia,
    devices: opts.devices || [
      { deviceId: 'cam-front', kind: 'videoinput', label: 'Front camera' },
      { deviceId: 'cam-back', kind: 'videoinput', label: 'Back camera' },
      { deviceId: 'mic', kind: 'audioinput', label: 'Microphone' },
    ],
    mediaFailTimes: opts.mediaFailTimes || 0,
    delay: opts.delay == null ? 4 : opts.delay,
    events: [],
    clipboard: [],
    statsClock: Date.now(),
  };
  bus.log = (e) => { bus.events.push(e); return e; };
  bus.byType = (t) => bus.events.filter(e => e.type === t);

  bus.connectMedia = function (caller, callee) {
    const pcA = caller.peerConnection, pcB = callee.peerConnection;
    bus.links.set(pcA, pcB); bus.links.set(pcB, pcA);
    const shouldFail = bus.failNextMedia > 0;
    if (shouldFail && !bus.mediaFailSticky) bus.failNextMedia--;
    setTimeout(() => {
      if (shouldFail) {
        pcA.setIce('failed'); pcB.setIce('failed');
        pcA.setState('failed'); pcB.setState('failed');
        bus.log({ type: 'media-failed' });
        return;
      }
      if ((pcA.config && pcA.config.iceTransportPolicy === 'relay') || (pcB.config && pcB.config.iceTransportPolicy === 'relay')) bus.relayUsed = true;
      pcA.setState('connecting'); pcB.setState('connecting');
      pcA.setIce('checking'); pcB.setIce('checking');
      setTimeout(() => {
        pcA.setState('connected'); pcB.setState('connected');
        pcA.setIce('connected'); pcB.setIce('connected');
        // caller receives the answerer's stream; answerer receives the caller's stream
        if (callee._answerStream) caller.emit('stream', callee._answerStream);
        if (caller._stream) callee.emit('stream', caller._stream);
        bus.log({ type: 'media-connected' });
      }, bus.delay);
    }, bus.delay);
  };
  return bus;
}

export function installFakes(win, bus, name) {
  class FakeTrack {
    constructor(kind, label) { this.kind = kind; this.label = label || kind; this.enabled = true; this.readyState = 'live'; this.onended = null; this.contentHint = ''; this.id = 'trk-' + Math.random().toString(16).slice(2, 8); }
    stop() { this.readyState = 'ended'; if (this.onended) { try { this.onended(); } catch (e) {} } }
    applyConstraints() { return Promise.resolve(); }
    getSettings() { return { width: 1920, height: 1080, frameRate: 30, facingMode: 'user', sampleRate: 48000 }; }
    getCapabilities() { return {}; }
  }
  class FakeMediaStream {
    constructor(tracks) { this._tracks = Array.isArray(tracks) ? tracks.slice() : []; this.id = 'strm-' + Math.random().toString(16).slice(2, 8); }
    getTracks() { return this._tracks.slice(); }
    getVideoTracks() { return this._tracks.filter(t => t.kind === 'video'); }
    getAudioTracks() { return this._tracks.filter(t => t.kind === 'audio'); }
    addTrack(t) { if (t && this._tracks.indexOf(t) < 0) this._tracks.push(t); }
    removeTrack(t) { this._tracks = this._tracks.filter(x => x !== t); }
  }
  class FakeSender {
    constructor(track) { this.track = track || null; this._params = { encodings: [{}] }; }
    async replaceTrack(t) { this.track = t; bus.log({ type: 'replaceTrack', win: name, kind: t && t.kind, id: t && t.id }); return true; }
    getParameters() { return JSON.parse(JSON.stringify(this._params)); }
    async setParameters(p) { this._params = p; bus.log({ type: 'setParameters', win: name, maxBitrate: (p.encodings && p.encodings[0] && p.encodings[0].maxBitrate) || null }); }
  }
  class FakeDataChannel extends Emitter {
    constructor(label) { super(); this.label = label; this.readyState = 'open'; }
    send(d) { const other = bus.links.get(this); if (other) setTimeout(() => other.emit('message', { data: d }), 1); }
    close() { this.readyState = 'closed'; }
  }
  class FakePC extends Emitter {
    constructor(config) {
      super();
      this.config = config || {};
      bus.log({ type: 'pc-created', win: name, policy: this.config.iceTransportPolicy || 'all', servers: (this.config.iceServers || []).map(s => (s.name || (Array.isArray(s.urls) ? s.urls[0] : s.urls))) });
      this._senders = []; this._t0 = Date.now();
      this.localDescription = null; this.remoteDescription = null; this.currentRemoteDescription = null;
      this.iceConnectionState = 'new'; this.connectionState = 'new'; this.iceGatheringState = 'new'; this.signalingState = 'stable';
      this.onicecandidate = null; this.oniceconnectionstatechange = null; this.onconnectionstatechange = null;
      this.ontrack = null; this.ondatachannel = null; this.onnegotiationneeded = null; this.onicegatheringstatechange = null;
      this._probeRelay = (this.config.iceServers && this.config.iceServers[0] && this.config.iceServers[0].name) || null;
    }
    setIce(s) { this.iceConnectionState = s; if (this.oniceconnectionstatechange) { try { this.oniceconnectionstatechange(); } catch (e) {} } this.emit('iceconnectionstatechange'); }
    setState(s) { this.connectionState = s; if (this.onconnectionstatechange) { try { this.onconnectionstatechange(); } catch (e) {} } this.emit('connectionstatechange'); }
    addTrack(track, stream) { const s = new FakeSender(track); this._senders.push(s); return s; }
    removeTrack(s) { this._senders = this._senders.filter(x => x !== s); }
    getSenders() { return this._senders.slice(); }
    createDataChannel(label) { const c = new FakeDataChannel(label); const other = bus.links.get(this); if (other && other.ondatachannel) setTimeout(() => other.ondatachannel({ channel: c }), 1); return c; }
    async createOffer() { return { type: 'offer', sdp: 'fake-offer-' + Math.random() }; }
    async createAnswer() { return { type: 'answer', sdp: 'fake-answer-' + Math.random() }; }
    async setLocalDescription(d) {
      this.localDescription = d;
      if (this._probeRelay) {
        const relayName = this._probeRelay;
        const ok = bus.workingRelays.indexOf(relayName) >= 0;
        setTimeout(() => {
          if (this.connectionState === 'closed') return;
          if (ok) {
            this.iceGatheringState = 'gathering';
            if (this.onicecandidate) this.onicecandidate({ candidate: { candidate: 'candidate:1 1 udp 200 45.12.7.9 51000 typ relay raddr 0.0.0.0 rport 0', toJSON: () => ({ candidate: 'relay' }) } });
            bus.log({ type: 'probe-relay-ok', win: name, relay: relayName });
          } else {
            bus.log({ type: 'probe-relay-fail', win: name, relay: relayName });
            this.setIce('failed');
            this.iceGatheringState = 'complete';
            if (this.onicegatheringstatechange) this.onicegatheringstatechange();
          }
        }, bus.delay);
        return;
      }
      this.iceGatheringState = 'complete';
      if (this.onicegatheringstatechange) this.onicegatheringstatechange();
    }
    async setRemoteDescription(d) { this.remoteDescription = d; this.currentRemoteDescription = d; }
    async addIceCandidate() { return true; }
    restartIce() { bus.log({ type: 'restartIce', win: name }); }
    setConfiguration(c) { this.config = c; bus.log({ type: 'setConfiguration', win: name, policy: c.iceTransportPolicy }); }
    async getStats() {
      const secs = (Date.now() - this._t0) / 1000;
      const m = new Map();
      m.set('pair1', { type: 'candidate-pair', selected: true, state: 'succeeded', nominated: true, currentRoundTripTime: 0.045, localCandidateId: 'lc1', remoteCandidateId: 'rc1' });
      m.set('lc1', { type: 'local-candidate', candidateType: bus.relayUsed ? 'relay' : 'host' });
      m.set('rc1', { type: 'remote-candidate', candidateType: 'host' });
      m.set('out1', { type: 'outbound-rtp', kind: 'video', bytesSent: Math.floor(secs * 300000), framesPerSecond: 30 });
      m.set('in1', { type: 'inbound-rtp', kind: 'video', bytesReceived: Math.floor(secs * 300000), packetsLost: 2, packetsReceived: 900 });
      return m;
    }
    close() { this.connectionState = 'closed'; this.iceConnectionState = 'closed'; const other = bus.links.get(this); if (other && other.connectionState !== 'closed') { other.setState('disconnected'); other.setIce('disconnected'); } }
  }
  class FakeDataConnection extends Emitter {
    constructor(localPeer, remoteId, opts) {
      super();
      this.peer = remoteId; this.open = false; this.metadata = (opts && opts.metadata) || null;
      this._local = localPeer; this.type = 'data';
    }
    send(data) {
      if (!this.open) throw new Error('connection not open');
      const other = bus.links.get(this);
      bus.log({ type: 'wire', from: name, data });
      if (other) setTimeout(() => other.emit('data', data), 1);
    }
    close() {
      if (this._closed) return; this._closed = true; this.open = false;
      const other = bus.links.get(this);
      if (other && !other._closed) { other._closed = true; other.open = false; setTimeout(() => other.emit('close'), 1); }
      this.emit('close');
    }
  }
  class FakeMediaConnection extends Emitter {
    constructor(localPeer, remoteId, stream, opts) {
      super();
      this.peer = remoteId; this.metadata = (opts && opts.metadata) || null; this.open = false;
      this._local = localPeer; this._stream = stream; this._answerStream = null; this.type = 'media';
      this.peerConnection = new FakePC(localPeer.config || {});
      if (stream && stream.getTracks) stream.getTracks().forEach(t => this.peerConnection.addTrack(t, stream));
    }
    answer(stream) {
      this._answerStream = stream || new FakeMediaStream();
      if (this._answerStream.getTracks) this._answerStream.getTracks().forEach(t => this.peerConnection.addTrack(t, this._answerStream));
      this._role = 'callee';
      const other = bus.links.get(this);
      if (other) { other._role = 'caller'; bus.connectMedia(other /* caller */, this /* callee */); }
      else bus.log({ type: 'answer-no-link', win: name });
    }
    close() {
      if (this._closed) return; this._closed = true;
      try { this.peerConnection.close(); } catch (e) {}
      const other = bus.links.get(this);
      if (other && !other._closed) { other._closed = true; setTimeout(() => other.emit('close'), 1); }
      this.emit('close');
    }
  }
  class FakePeer extends Emitter {
    constructor(a, b) {
      super();
      let id = null, opts = {};
      if (typeof a === 'string') { id = a; opts = b || {}; } else { opts = a || {}; }
      this.options = opts; this.config = opts.config || null;
      this.destroyed = false; this.disconnected = false; this.open = false; this.id = null;
      bus.log({ type: 'peer-new', win: name, wantId: id, policy: (this.config && this.config.iceTransportPolicy) || 'all', relayCount: (this.config && this.config.iceServers || []).filter(s => s.name || String(Array.isArray(s.urls) ? s.urls[0] : s.urls).startsWith('turn')).length });
      setTimeout(() => {
        if (this.destroyed) return;
        const useId = id || ('rand-' + name + '-' + Math.random().toString(16).slice(2, 7));
        if (bus.peers.has(useId)) { bus.log({ type: 'unavailable-id', win: name, id: useId }); this.emit('error', { type: 'unavailable-id' }); return; }
        this.id = useId; bus.peers.set(useId, this); this.open = true;
        bus.log({ type: 'peer-open', win: name, id: useId });
        this.emit('open', useId);
      }, bus.delay);
    }
    connect(remoteId, opts) {
      const conn = new FakeDataConnection(this, remoteId, opts);
      const remote = bus.peers.get(remoteId);
      if (!remote || remote.destroyed) {
        setTimeout(() => { bus.log({ type: 'peer-unavailable', win: name, remoteId }); this.emit('error', { type: 'peer-unavailable' }); }, bus.delay);
        conn.close = function () { this._closed = true; this.open = false; };
        return conn;
      }
      const other = new FakeDataConnection(remote, this.id, opts);
      bus.links.set(conn, other); bus.links.set(other, conn);
      setTimeout(() => { remote.emit('connection', other); }, bus.delay);
      setTimeout(() => { conn.open = true; other.open = true; conn.emit('open'); other.emit('open'); }, bus.delay * 2);
      return conn;
    }
    call(remoteId, stream, opts) {
      const mc = new FakeMediaConnection(this, remoteId, stream, opts);
      const remote = bus.peers.get(remoteId);
      if (!remote || remote.destroyed) {
        setTimeout(() => { bus.log({ type: 'peer-unavailable', win: name, remoteId, via: 'call' }); this.emit('error', { type: 'peer-unavailable' }); }, bus.delay);
        mc.close = function () { this._closed = true; try { this.peerConnection.close(); } catch (e) {} };
        return mc;
      }
      const other = new FakeMediaConnection(remote, this.id, null, opts);
      bus.links.set(mc, other); bus.links.set(other, mc);
      bus.links.set(mc.peerConnection, other.peerConnection); bus.links.set(other.peerConnection, mc.peerConnection);
      setTimeout(() => { remote.emit('call', other); }, bus.delay);
      return mc;
    }
    reconnect() { this.disconnected = false; bus.log({ type: 'peer-reconnect', win: name }); }
    destroy() {
      if (this.destroyed) return; this.destroyed = true; this.open = false;
      if (this.id && bus.peers.get(this.id) === this) bus.peers.delete(this.id);
      bus.log({ type: 'peer-destroy', win: name, id: this.id });
      this.emit('close');
    }
  }

  win.Peer = FakePeer;
  win.RTCPeerConnection = FakePC;
  win.MediaStream = FakeMediaStream;
  win.MediaStreamTrack = FakeTrack;
  win.RTCSessionDescription = function (d) { return d; };
  win.RTCIceCandidate = function (c) { return c; };

  // media devices
  let calls = 0;
  const md = {
    async getUserMedia(constraints) {
      calls++;
      bus.log({ type: 'getUserMedia', win: name, attempt: calls, constraints: JSON.parse(JSON.stringify(constraints || {})) });
      if (bus.mediaFailTimes > 0 && calls <= bus.mediaFailTimes) {
        const e = new Error('overconstrained'); e.name = 'OverconstrainedError'; throw e;
      }
      if (constraints && constraints.video === false && constraints.audio === false) { const e = new Error('nothing requested'); e.name = 'TypeError'; throw e; }
      const tracks = [];
      if (constraints && constraints.video) tracks.push(new FakeTrack('video', 'camera'));
      if (constraints && constraints.audio) tracks.push(new FakeTrack('audio', 'mic'));
      return new FakeMediaStream(tracks);
    },
    async getDisplayMedia() {
      if (bus.noDisplayMedia) { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; }
      bus.log({ type: 'getDisplayMedia', win: name });
      return new FakeMediaStream([new FakeTrack('video', 'screen')]);
    },
    async enumerateDevices() { return bus.devices.slice(); },
  };
  win.navigator.mediaDevices = md;
  win.navigator.vibrate = () => true;
  win.navigator.share = null;
  if (!win.navigator.clipboard) win.navigator.clipboard = {};
  win.navigator.clipboard.writeText = (t) => { bus.clipboard.push(t); return Promise.resolve(); };

  // audio (only used for >100% boost)
  win.AudioContext = class {
    constructor() { this.state = 'running'; this.destination = { kind: 'dest' }; bus.log({ type: 'audiocontext', win: name }); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createMediaStreamSource(s) { return { connect: () => {}, disconnect: () => {}, _s: s }; }
    createGain() { const g = { gain: { value: 1 }, connect: () => {}, disconnect: () => {} }; return g; }
  };

  // media elements: jsdom has no media support
  if (win.HTMLMediaElement) {
    win.HTMLMediaElement.prototype.play = function () { bus.log({ type: 'play', win: name, id: this.id }); return Promise.resolve(); };
    win.HTMLMediaElement.prototype.pause = function () {};
  }
  // fullscreen
  win.Element.prototype.requestFullscreen = function () { bus.log({ type: 'fullscreen', win: name, id: this.id }); return Promise.resolve(); };
  Object.defineProperty(win.document, 'fullscreenElement', { value: null, configurable: true, writable: true });
  win.document.exitFullscreen = () => Promise.resolve();

  win.__fakes = { FakeTrack, FakeMediaStream, FakePC, calls: () => calls };
  return { FakeMediaStream, FakeTrack };
}
