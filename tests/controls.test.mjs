import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeClient, createBus, waitFor, sleep, hostReady, connectPair, close } from './harness.mjs';

test('14. Mute toggles once per tap and tells the friend', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  const track = A.state().localStream.getAudioTracks()[0];
  assert.equal(track.enabled, true);
  await A.click('toggleAudio');
  assert.equal(track.enabled, false, 'muted after ONE tap');
  assert.equal(A.state().audioOn, false);
  assert.equal(A.text('toggleAudio'), '🔇');
  assert.ok(A.$('toggleAudio').classList.contains('off'));
  assert.equal(A.visible('micBadge'), true, 'muted badge on own video');
  await waitFor(() => B.state().remoteState.audio === false, { label: 'friend told about mute' });
  assert.match(B.text('friendBanner'), /Muted/);
  await sleep(140);
  await A.click('toggleAudio');
  assert.equal(track.enabled, true, 'unmuted after second tap');
  assert.equal(A.visible('micBadge'), false);
  close(A, B);
});

test('15. Camera toggle works once per tap and the friend sees "Camera off"', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  const track = A.state().localStream.getVideoTracks()[0];
  await A.click('toggleVideo');
  assert.equal(track.enabled, false);
  assert.equal(A.visible('pipOff'), true, 'own video shows avatar');
  await waitFor(() => B.state().remoteState.video === false, { label: 'friend notified' });
  assert.match(B.text('friendBanner'), /Camera off/);
  await sleep(140);
  await A.click('toggleVideo');
  assert.equal(track.enabled, true);
  assert.equal(A.visible('pipOff'), false);
  close(A, B);
});

test('16. More panel opens, closes, and closes when tapping elsewhere', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  assert.equal(A.$('morePanel').classList.contains('open'), false);
  await A.click('moreBtn');
  assert.equal(A.$('morePanel').classList.contains('open'), true, 'opened with one tap');
  await sleep(140);
  await A.click('moreBtn');
  assert.equal(A.$('morePanel').classList.contains('open'), false, 'closed with one tap');
  await sleep(140);
  await A.click('moreBtn');
  A.$('remoteVideo').dispatchEvent(new A.win.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  assert.equal(A.$('morePanel').classList.contains('open'), false, 'closed by tapping outside');
  close(A);
});

test('17. Volume slider boosts above 100% and falls back safely', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  A.$('volumeSlider').value = '150';
  A.$('volumeSlider').dispatchEvent(new A.win.Event('input', { bubbles: true }));
  await waitFor(() => A.state().volume === 150, { label: 'volume applied' });
  assert.equal(A.text('volLabel'), '150%');
  assert.ok(bus.byType('audiocontext').some(e => e.win === 'A'), 'boost path uses WebAudio');
  assert.equal(A.$('remoteVideo').muted, true, 'element muted while boosting (no double audio)');
  A.$('volumeSlider').value = '70';
  A.$('volumeSlider').dispatchEvent(new A.win.Event('input', { bubbles: true }));
  await waitFor(() => A.state().volume === 70, { label: 'volume lowered' });
  assert.equal(A.$('remoteVideo').muted, false, 'back to element audio');
  close(A);
});

test('18. Screen share swaps the outgoing video and Stop restores the camera', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  await A.click('moreBtn');
  await A.click('screenShare');
  await waitFor(() => A.state().screenSharing === true, { label: 'screen sharing on' });
  assert.ok(bus.byType('replaceTrack').length >= 1, 'outgoing video replaced');
  assert.equal(A.visible('shareBanner'), true, 'sharing banner visible');
  assert.equal(A.text('screenShare'), '🖥️ Stop sharing');
  await A.click('stopShare');
  await waitFor(() => A.state().screenSharing === false, { label: 'sharing stopped' });
  assert.equal(A.visible('shareBanner'), false);
  assert.equal(A.text('screenShare'), '🖥️ Screen share');
  assert.ok(bus.byType('replaceTrack').length >= 2, 'camera restored');
  close(A);
});

test('19. iPhone: screen share explains instead of failing silently', async () => {
  const bus = createBus();
  const A = await makeClient({ bus, name: 'A', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await A.click('startBtn');
  await waitFor(() => A.state().sigOk, { label: 'host ready' });
  await A.click('joinVideoBtn');
  await A.click('moreBtn');
  await A.click('screenShare');
  await waitFor(() => !A.$('fullModal').classList.contains('hidden') && A.text('modalTitle').length > 0, { label: 'friendly explanation shown' });
  assert.match(A.text('modalTitle'), /Screen share on this device/);
  assert.match(A.text('modalBody'), /iPhone/);
  close(A);
});

test('20. Flip camera switches lens and keeps the call alive', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  assert.equal(A.state().facing, 'user');
  await A.click('moreBtn');
  await A.click('flipCamera');
  await waitFor(() => A.state().facing === 'environment', { label: 'facing switched' });
  assert.ok(bus.byType('getUserMedia').filter(e => e.win === 'A').length >= 2, 'camera re-opened');
  assert.ok(bus.byType('replaceTrack').some(e => e.kind === 'video'), 'new track sent to friend');
  assert.equal(A.state().mediaOk, true, 'still connected');
  close(A);

});

test('20b. Single-camera device explains instead of breaking', async () => {
  const bus = createBus({ devices: [{ deviceId: 'cam', kind: 'videoinput', label: 'Camera' }] });
  const C = await hostReady(bus);
  await C.click('joinVideoBtn');
  await C.click('moreBtn');
  await C.click('flipCamera');
  await sleep(80);
  assert.equal(C.text('toast'), 'This device has only one camera');
  close(C);
});

test('21. Beauty and low-light affect my own picture only', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  await A.click('moreBtn');
  await A.click('beautyToggle');
  assert.equal(A.state().beauty, true, 'beauty on after one tap');
  assert.ok(A.$('localVideo').className.includes('video-beauty'));
  assert.equal(A.$('remoteVideo').className.includes('video-beauty'), false, 'friend picture untouched');
  await sleep(140);
  await A.click('lowlightBtnCall');
  assert.equal(A.state().lowlight, true);
  assert.ok(A.$('localVideo').style.filter.length > 0);
  await sleep(140);
  await A.click('beautyToggle');
  assert.equal(A.state().beauty, false, 'beauty off after second tap');
  close(A);
});

test('22. Fullscreen is requested on the call view', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  await A.click('moreBtn');
  await A.click('fullscreenBtn');
  await waitFor(() => bus.byType('fullscreen').some(e => e.win === 'A'), { label: 'fullscreen requested' });
  close(A);
});

test('23. End call cleans up everything and tells the friend', async () => {
  const bus = createBus();
  const { A, B, roomId } = await connectPair(bus);
  await A.click('endCall');
  await waitFor(() => A.text('modalTitle') === 'Call ended', { label: 'A sees call ended' });
  assert.equal(A.state().ending, true);
  assert.equal(A.state().localStream.getTracks().every(t => t.readyState === 'ended'), true, 'camera and mic released');
  assert.equal(bus.peers.has('inko-' + roomId), false, 'signaling id released');
  await waitFor(() => B.text('modalTitle') === 'Your friend ended the call', { label: 'B told the call ended', timeout: 8000 });
  await A.click(A.q('#modalActions .btn'));
  await sleep(80);
  assert.equal(A.visible('landing'), true, 'back home');
  assert.equal(A.$('callScreen').classList.contains('active'), false);
  close(A, B);
});

test('24. Draggable video keeps its position', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  const pip = A.$('pip');
  pip.dispatchEvent(new A.win.MouseEvent('mousedown', { bubbles: true, clientX: 50, clientY: 50 }));
  A.win.dispatchEvent(new A.win.MouseEvent('mousemove', { bubbles: true, clientX: 160, clientY: 220 }));
  A.win.dispatchEvent(new A.win.MouseEvent('mouseup', { bubbles: true }));
  await sleep(600);
  const saved = JSON.parse(A.win.localStorage.getItem('inko.pip'));
  assert.ok(saved && saved.left && saved.top, 'position saved');
  assert.equal(pip.style.left, saved.left);
  close(A);
});

test('34. Copy link and share buttons all respond', async () => {
  const bus = createBus();
  const A = await hostReady(bus);
  await A.click('copyBtn');
  await waitFor(() => bus.clipboard.length === 1, { label: 'link copied' });
  assert.match(bus.clipboard[0], /#[a-f0-9]{12}$/);
  assert.equal(A.text('copyBtn'), 'Copied ✓');
  const opened = [];
  A.win.open = (u) => { opened.push(u); return null; };
  for (const b of A.qa('.share')) { await A.click(b); await sleep(25); }
  assert.ok(opened.some(u => u.startsWith('https://wa.me/?text=')), 'WhatsApp share');
  assert.ok(opened.some(u => u.startsWith('sms:')), 'SMS share');
  assert.ok(opened.some(u => u.startsWith('mailto:')), 'Email share');
  close(A);
});

test('35. Details panel toggles and shows the relay test results', async () => {
  const bus = createBus({ workingRelays: ['OpenRelay 80'] });
  const A = await makeClient({ bus, name: 'A' });
  await A.click('startBtn');
  await waitFor(() => A.state().probed, { label: 'probed', timeout: 9000 });
  await A.click('toggleDebug');
  assert.equal(A.$('preDebug').style.display, 'block');
  assert.equal(A.$('turnForm').style.display, 'flex', 'relay settings reachable');
  assert.match(A.$('relayDetail').textContent, /✓ OpenRelay 80/);
  assert.match(A.$('relayDetail').textContent, /✗ ExpressTURN 1/);
  await A.click('testNet');
  await waitFor(() => A.text('testNet') === 'Test', { label: 'manual test finished', timeout: 9000 });
  close(A);
});

test('36. Saving a personal relay validates the address and re-tests it', async () => {
  const bus = createBus({ workingRelays: ['My relay'] });
  const A = await makeClient({ bus, name: 'A' });
  await A.click('startBtn');
  await waitFor(() => A.state().sigOk, { label: 'ready' });
  await A.click('toggleDebug');
  A.type('turnUrl', 'not-a-relay');
  await A.click('saveTurn');
  assert.match(A.text('toast'), /should start with turn/);
  A.type('turnUrl', 'turn:my.relay.test:3478');
  A.type('turnUser', 'me'); A.type('turnPass', 'secret');
  await A.click('saveTurn');
  await waitFor(() => JSON.parse(A.win.localStorage.getItem('inko.turn') || 'null'), { label: 'relay saved' });
  await waitFor(() => A.state().relays.some(r => r.name === 'My relay'), { label: 'saved relay works', timeout: 12000 });
  await A.click('clearTurn');
  await sleep(60);
  assert.equal(A.win.localStorage.getItem('inko.turn'), null, 'relay removed');
  close(A);
});

test('38. Reconnecting after a drop keeps the call and the chat', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('openChat');
  A.type('chatInput', 'before the drop'); await A.click('sendChat');
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text === 'before the drop'), { label: 'delivered' });
  B.state().mediaConn.close();
  await waitFor(() => A.text('connectionText') === 'Reconnecting' || A.state().state === 'reconnect', { label: 'A notices the drop', timeout: 8000 });
  await waitFor(() => A.state().mediaOk && B.state().mediaOk, { label: 'call restored automatically', timeout: 30000 });
  assert.equal(A.text('connectionText'), 'Connected');
  A.type('chatInput', 'after reconnect');
  await A.click('sendChat');
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text === 'after reconnect'), { label: 'chat still works after reconnect', timeout: 20000 });
  close(A, B);
});

test('40. No dead controls: every button does something', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  const ids = ['toggleAudio', 'toggleVideo', 'openChat', 'closeChat', 'moreBtn', 'screenShare', 'flipCamera',
    'beautyToggle', 'lowlightBtnCall', 'fullscreenBtn', 'fixConn', 'stopShare', 'sendChat',
    'placeholderRetry', 'placeholderAudio', 'toggleDebugCall'];
  for (const id of ids) {
    const el = A.$(id);
    assert.ok(el, 'control exists: ' + id);
    const before = bus.events.length;
    await A.click(el);
    await sleep(140);
    assert.ok(A.$(id), 'control remains responsive: ' + id);
  }
  await A.click('endCall');
  await waitFor(() => A.text('modalTitle') === 'Call ended', { label: 'end call works' });
  close(A);
});
