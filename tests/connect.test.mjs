import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeClient, createBus, waitFor, sleep, hostReady, connectPair, close } from './harness.mjs';

test('1. Start creates a private link, registers signaling, and shows an honest status', async () => {
  const bus = createBus();
  const A = await makeClient({ bus, name: 'A' });
  await A.click('startBtn');
  await waitFor(() => A.state().sigOk && A.state().roomId, { label: 'host ready' });
  const roomId = A.state().roomId;
  assert.match(roomId, /^[a-f0-9]{12}$/, 'room id is 12 hex chars');
  assert.equal(A.$('shareLink').value, 'https://inkocaller.test/#' + roomId);
  assert.ok(bus.peers.has('inko-' + roomId), 'signaling id registered');
  assert.equal(A.text('connectionText'), 'Waiting for your friend', 'status must NOT claim connected while alone');
  assert.equal(A.text('preCount'), '1 of 2 people');
  close(A);
});

test('2. Friend taps the link → both connect, both see each other, timer runs', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  assert.equal(A.state().activeRemoteId, B.state().myPeerId);
  assert.equal(B.state().activeRemoteId, A.state().myPeerId);
  assert.ok(A.$('remoteVideo').srcObject, 'A has remote video');
  assert.ok(B.$('remoteVideo').srcObject, 'B has remote video');
  assert.equal(A.state().state, 'connected');
  assert.equal(A.text('connectionText'), 'Connected');
  assert.equal(B.text('connectionText'), 'Connected');
  assert.equal(A.visible('remotePlaceholder'), false, 'waiting screen hidden once connected');
  assert.equal(A.text('preCount'), '2 of 2 people', 'people counter updated');
  await sleep(1200);
  assert.ok(A.state().secs >= 1, 'call duration counting');
  close(A, B);
});

test('3. Audio plays exactly once (no doubled/echo output)', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  assert.equal(A.qa('audio').length, 0, 'no extra audio element in the DOM');
  assert.equal(A.$('remoteVideo').muted, false, 'remote video carries the sound');
  const plays = bus.byType('play').filter(e => e.win === 'A' && e.id === 'remoteVideo').length;
  assert.ok(plays >= 1 && plays < 8, 'remote video played, not spammed: ' + plays);
  close(A, B);
});

test('4. A third person is rejected with "already full" and stops retrying', async () => {
  const bus = createBus();
  const { A, B, roomId } = await connectPair(bus);
  const C = await makeClient({ bus, name: 'C', hash: roomId });
  await waitFor(() => C.state().mediaReady, { label: 'C media', timeout: 8000 });
  await C.click('joinVideoBtn');
  await waitFor(() => C.state().full === true, { label: 'C told the call is full', timeout: 10000 });
  assert.equal(C.text('modalTitle'), 'This call is already full');
  assert.match(C.text('modalBody'), /two people/i);
  assert.equal(A.state().activeRemoteId, B.state().myPeerId, 'host still paired with the first friend');
  assert.equal(A.state().state, 'connected', 'the ongoing call is untouched');
  const blockedNow = bus.byType('peer-unavailable').length;
  await sleep(4000);
  assert.equal(bus.events.filter(e => e.type === 'peer-unavailable').length, blockedNow, 'rejected person does NOT loop forever');
  assert.equal(A.text('connectionText'), 'Connected', 'call still fine after 4s');
  close(A, B, C);
});

test('25. Relay probe keeps only relays that actually answer, and caches them', async () => {
  const bus = createBus({ workingRelays: ['OpenRelay 443', 'FreeSTUN'] });
  const A = await makeClient({ bus, name: 'A' });
  await waitFor(() => A.state().probed === true, { label: 'probe finished', timeout: 9000 });
  const names = A.state().relays.map(r => r.name).sort();
  assert.equal(names.join(','), 'FreeSTUN,OpenRelay 443', 'dead relays dropped');
  const cfg = A.win.inko.iceConfig('all');
  assert.ok(cfg.iceServers.some(s => s.name === 'OpenRelay 443'), 'working relay used');
  assert.equal(cfg.iceTransportPolicy, 'all');
  const relayCfg = A.win.inko.iceConfig('relay');
  assert.equal(relayCfg.iceTransportPolicy, 'relay');
  assert.equal(relayCfg.iceServers.every(s => !!s.name), true, 'relay-only has no STUN entries');
  const cache = JSON.parse(A.win.localStorage.getItem('inko.relays'));
  assert.ok(cache && cache.ok.includes('OpenRelay 443'), 'result cached on device');
  assert.match(A.text('netLineText'), /TURN relay reachable from this network/);
  close(A);
});

test('26. A saved personal relay is tried first', async () => {
  const bus = createBus({ workingRelays: ['My relay'] });
  const A = await makeClient({ bus, name: 'A', storage: { 'inko.turn': { url: 'turn:my.turn.example:3478', user: 'u1', pass: 'p1' } } });
  await waitFor(() => A.state().probed === true, { label: 'probe finished', timeout: 9000 });
  assert.equal(A.state().relays.map(r => r.name).join(','), 'My relay');
  assert.equal(A.state().relays[0].username, 'u1');
  assert.match(A.text('netLineText'), /TURN relay reachable from this network/);
  close(A);
});

test('27a. Static Pages with no TURN config clearly reports that cross-network relay is missing', async () => {
  const bus = createBus({ turnServers: [] });
  const A = await makeClient({ bus, name: 'A' });
  await waitFor(() => A.state().probed === true, { label: 'relay probe finished', timeout: 4000 });
  assert.equal(A.state().relays.length, 0);
  assert.match(A.text('netLineText'), /No relay configured/);
  assert.match(A.$('relayDetail').textContent, /Add and test a TURN relay/);
  close(A);
});

test('27. No relay available → honest warning plus a way to fix it', async () => {
  const bus = createBus({ workingRelays: [] });
  const A = await makeClient({ bus, name: 'A' });
  await waitFor(() => A.state().probed === true, { label: 'probe finished', timeout: 9000 });
  assert.equal(A.state().relays.length, 0);
  assert.match(A.text('netLineText'), /Configured relay unavailable/);
  await A.click('startBtn');
  await waitFor(() => A.state().sigOk, { label: 'host ready' });
  await A.click('joinVideoBtn');
  await A.click('fixConn');
  await waitFor(() => A.text('modalTitle').length > 0, { label: 'explains what to do', timeout: 9000 });
  assert.match(A.text('modalTitle'), /Your network needs a relay/);
  assert.match(A.text('modalBody'), /mobile data|relay server/i);
  close(A);
});

test('28. When a direct route fails it automatically switches to a relay and connects', async () => {
  const bus = createBus({ failNextMedia: 1, workingRelays: ['ExpressTURN 1'] });
  const A = await hostReady(bus);
  const roomId = A.state().roomId;
  await A.click('joinVideoBtn');
  const B = await makeClient({ bus, name: 'B', hash: roomId });
  await waitFor(() => B.state().mediaReady, { label: 'B media', timeout: 8000 });
  await B.click('joinVideoBtn');
  await waitFor(() => bus.byType('media-failed').length >= 1, { label: 'first attempt failed', timeout: 8000 });
  await waitFor(() => A.state().mode === 'relay' || B.state().mode === 'relay', { label: 'escalated to relay-only', timeout: 15000 });
  await waitFor(() => A.state().mediaOk && B.state().mediaOk, { label: 'connected through relay', timeout: 25000 });
  assert.equal(bus.relayUsed, true, 'relay transport actually used');
  assert.equal(A.text('connectionText'), 'Connected');
  close(A, B);
});

test('29. Friend joins late: the link keeps trying instead of dying', async () => {
  const bus = createBus();
  const roomId = 'aabbccddeeff';
  const B = await makeClient({ bus, name: 'B', hash: roomId });
  await waitFor(() => B.state().mediaReady, { label: 'B media', timeout: 8000 });
  await B.click('joinVideoBtn');
  await waitFor(() => B.state().guestTries >= 1, { label: 'B keeps retrying', timeout: 8000 });
  const A = await hostReady(bus, { roomId });
  await A.click('joinVideoBtn');
  await waitFor(() => A.state().mediaOk && B.state().mediaOk, { label: 'connected once host arrived', timeout: 25000 });
  assert.equal(A.text('connectionText'), 'Connected');
  assert.equal(B.text('connectionText'), 'Connected');
  close(A, B);
});

test('30. Camera that refuses HD settings still works (graceful fallback)', async () => {
  const bus = createBus({ mediaFailTimes: 2 });
  const A = await makeClient({ bus, name: 'A' });
  await A.click('startBtn');
  await waitFor(() => A.state().mediaReady === true, { label: 'media ready after fallback', timeout: 9000 });
  const attempts = bus.byType('getUserMedia').filter(e => e.win === 'A');
  assert.ok(attempts.length >= 3, 'tried several quality levels: ' + attempts.length);
  assert.ok(A.$('previewVideo').srcObject, 'preview shows the camera');
  assert.equal(A.visible('permissionHelp'), false);
  close(A);
});

test('31. Camera fully blocked → voice-only call still possible', async () => {
  const bus = createBus({ mediaFailTimes: 5 });
  const A = await makeClient({ bus, name: 'A' });
  await A.click('startBtn');
  await waitFor(() => A.state().sigOk, { label: 'host ready even without camera', timeout: 9000 });
  assert.equal(A.visible('permissionHelp'), true, 'shows how to allow the camera');
  assert.equal(A.visible('previewOff'), true, 'preview shows camera-off state');
  assert.match(A.text('previewOffText'), /voice still works/);
  close(A);
});

test('32. Live quality readout and adaptive bitrate', async () => {
  const bus = createBus({ workingRelays: ['ExpressTURN 1'] });
  const { A, B } = await connectPair(bus);
  await waitFor(() => A.state().quality.bitrate > 0, { label: 'bitrate measured', timeout: 9000 });
  assert.equal(A.visible('qualityPill'), true, 'quality pill visible while connected');
  assert.match(A.text('qLabel'), /HD|Good|OK|Weak/);
  await waitFor(() => bus.byType('setParameters').some(e => e.maxBitrate > 0), { label: 'adaptive bitrate applied', timeout: 9000 });
  close(A, B);
});

test('33. Connection status reflects the real peer connection, never a guess', async () => {
  const bus = createBus();
  const A = await hostReady(bus);
  assert.equal(A.state().state, 'waiting');
  assert.equal(A.text('connectionText'), 'Waiting for your friend');
  assert.equal(A.state().mediaConn, null, 'no media connection yet');
  const { A: A2, B } = await connectPair(bus);
  assert.equal(A2.state().state, 'connected');
  const realPc = A2.state().mediaConn.peerConnection;
  realPc.setState('disconnected'); realPc.setIce('disconnected');
  await waitFor(() => A2.text('connectionText') === 'Reconnecting', { label: 'status follows real state' });
  realPc.setState('connected'); realPc.setIce('connected');
  await waitFor(() => A2.text('connectionText') === 'Connected', { label: 'status recovers' });
  close(A, A2, B);
});

test('39. Leaving the page tells the friend the call ended', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  A.win.dispatchEvent(new A.win.Event('pagehide'));
  await waitFor(() => B.text('modalTitle') === 'Your friend ended the call', { label: 'friend notified on leave', timeout: 8000 });
  close(A, B);
});
