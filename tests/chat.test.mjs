import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeClient, createBus, waitFor, sleep, hostReady, connectPair, close } from './harness.mjs';

test('5. Chat delivers, shows Sent → Delivered ticks', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('openChat');
  await B.click('openChat');
  A.type('chatInput', 'hello from A');
  await A.click('sendChat');
  assert.equal(A.$('chatInput').value, '', 'input cleared after send');
  await waitFor(() => B.win.inko.Chat.list.some(m => !m.mine && m.text === 'hello from A'), { label: 'B received message' });
  await waitFor(() => { const m = A.win.inko.Chat.list.find(x => x.text === 'hello from A'); return m && (m.state === 'delivered' || m.state === 'read'); }, { label: 'A sees delivered tick' });
  assert.match(A.$('chatMessages').innerHTML, /✓✓/, 'delivered tick rendered');
  B.type('chatInput', 'hi A 👋');
  await B.click('sendChat');
  await waitFor(() => A.win.inko.Chat.list.some(m => !m.mine && m.text === 'hi A 👋'), { label: 'A received reply' });
  assert.ok(A.$('chatMessages').textContent.includes('hi A 👋'));
  close(A, B);
});

test('6. Read receipt turns ticks blue when the friend opens the chat', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('openChat');
  A.type('chatInput', 'read me');
  await A.click('sendChat');
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text === 'read me'), { label: 'B got it' });
  await B.click('openChat');
  await waitFor(() => { const m = A.win.inko.Chat.list.find(x => x.text === 'read me'); return m && m.state === 'read'; }, { label: 'A sees read receipt' });
  assert.match(A.$('chatMessages').innerHTML, /tick read/, 'read tick styled');
  close(A, B);
});

test('7. Unread badge counts messages while chat is closed and clears on open', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('openChat');
  for (const t of ['one', 'two', 'three']) { A.type('chatInput', t); await A.click('sendChat'); await sleep(50); }
  await waitFor(() => B.win.inko.Chat.list.filter(m => !m.mine && !m.sys).length === 3, { label: 'B received 3' });
  await waitFor(() => B.text('chatUnread') === '3', { label: 'B unread badge shows 3' });
  assert.equal(B.visible('chatUnread'), true);
  await B.click('openChat');
  await sleep(80);
  assert.equal(B.visible('chatUnread'), false, 'badge cleared after opening chat');
  close(A, B);
});

test('8. Messages typed before the friend joins are queued and delivered in order', async () => {
  const bus = createBus();
  const A = await hostReady(bus);
  const roomId = A.state().roomId;
  await A.click('joinVideoBtn');
  await A.click('openChat');
  for (const t of ['first', 'second', 'third']) { A.type('chatInput', t); await A.click('sendChat'); await sleep(40); }
  assert.equal(Array.from(A.win.inko.Chat.list).filter(m => m.mine).map(m => m.state).join(','), 'queued,queued,queued', 'queued while alone');
  assert.match(A.$('chatMessages').innerHTML, /🕓/, 'queued indicator shown');
  const B = await makeClient({ bus, name: 'B', hash: roomId });
  await waitFor(() => B.state().mediaReady, { label: 'B media', timeout: 8000 });
  await B.click('joinVideoBtn');
  await waitFor(() => B.win.inko.Chat.list.filter(m => !m.mine && !m.sys).map(m => m.text).join(',') === 'first,second,third', { label: 'all queued messages delivered in order', timeout: 15000 });
  await waitFor(() => A.win.inko.Chat.list.every(m => !m.mine || m.state === 'delivered' || m.state === 'read'), { label: 'A ticks updated after flush' });
  close(A, B);
});

test('9. Chat survives a refresh (stored on the device only)', async () => {
  const bus = createBus();
  const { A, B, roomId } = await connectPair(bus);
  await A.click('openChat');
  A.type('chatInput', 'remember me'); await A.click('sendChat');
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text === 'remember me'), { label: 'delivered' });
  const stored = A.win.localStorage.getItem('inko.chat.' + roomId);
  assert.ok(stored, 'chat persisted to device storage');
  const A2 = await makeClient({ bus: createBus(), name: 'A2', hash: roomId, storage: { ['inko.chat.' + roomId]: stored } });
  await waitFor(() => A2.win.inko.Chat.list.some(m => m.text === 'remember me'), { label: 'history restored after reload' });
  assert.ok(A2.$('chatMessages').textContent.includes('remember me'), 'history rendered');
  close(A, B, A2);
});

test('10. Typing indicator reaches the friend', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('openChat'); await B.click('openChat');
  A.type('chatInput', 'typing now');
  await waitFor(() => B.$('typing').classList.contains('show'), { label: 'B sees typing indicator' });
  assert.equal(B.text('typing'), 'Friend is typing…');
  await A.click('sendChat');
  await waitFor(() => !B.$('typing').classList.contains('show'), { label: 'typing hides after send' });
  close(A, B);
});

test('11. Tap a message → emoji reaction appears on both sides', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('openChat'); await B.click('openChat');
  A.type('chatInput', 'react to this'); await A.click('sendChat');
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text === 'react to this'), { label: 'B received' });
  const bubble = A.q('.msg.mine .bubble');
  assert.ok(bubble, 'message bubble exists');
  await A.click(bubble);
  const bar = A.q('.reactbar');
  assert.ok(bar, 'reaction picker opened on tap');
  assert.equal(bar.children.length, 5);
  await A.click(bar.children[0]);
  await waitFor(() => { const r = B.q('.reacts'); return r && r.textContent === '❤️'; }, { label: 'B shows the reaction' });
  assert.equal(A.q('.reacts').textContent, '❤️', 'A shows the reaction too');
  close(A, B);
});

test('12. Enter sends, quick emoji sends, blank is ignored', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('openChat');
  A.type('chatInput', 'sent with enter');
  A.key('chatInput', 'Enter');
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text === 'sent with enter'), { label: 'enter sent it' });
  assert.equal(A.$('chatInput').value, '');
  await A.click(A.q('#quickEmoji .react'));
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text === '❤️'), { label: 'quick emoji sent' });
  const before = A.win.inko.Chat.list.length;
  A.type('chatInput', '   ');
  await A.click('sendChat');
  assert.equal(A.win.inko.Chat.list.length, before, 'blank message ignored');
  close(A, B);
});

test('13. Chat panel never sits under the call buttons', async () => {
  const bus = createBus();
  const { A } = await connectPair(bus);
  await A.click('openChat');
  assert.ok(A.$('chatPanel').classList.contains('open'), 'chat open');
  assert.equal(A.$('controls').style.opacity, '0', 'call buttons hidden while chatting');
  assert.equal(A.$('controls').style.pointerEvents, 'none', 'call buttons cannot steal taps');
  assert.ok(A.$('chatInput'), 'input present');
  await A.click('closeChat');
  assert.equal(A.$('controls').style.opacity, '', 'call buttons restored');
  assert.equal(A.$('chatPanel').classList.contains('open'), false);
  close(A);
});

test('13b. Chat keeps working while the video is off (voice + text only)', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('toggleVideo');
  await A.click('openChat');
  A.type('chatInput', 'camera off but chat on');
  await A.click('sendChat');
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text === 'camera off but chat on'), { label: 'chat works with camera off' });
  close(A, B);
});

test('37. Reactions from the friend float on screen', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await B.click('openChat');
  await B.click(B.q('#quickEmoji .react'));
  await waitFor(() => A.q('#reactions div'), { label: 'reaction visible on A' });
  assert.equal(A.q('#reactions div').textContent, '❤️');
  close(A, B);
});

test('41. Undelivered message can be retried by tapping it', async () => {
  const bus = createBus();
  const A = await hostReady(bus);
  await A.click('joinVideoBtn');
  await A.click('openChat');
  A.type('chatInput', 'retry me');
  await A.click('sendChat');
  await waitFor(() => A.win.inko.Chat.list.some(m => m.state === 'queued'), { label: 'queued while alone' });
  // force a failed state, then retry through the UI
  const m = A.win.inko.Chat.list.find(x => x.text === 'retry me');
  m.state = 'failed'; A.win.inko.Chat.render();
  assert.match(A.$('chatMessages').innerHTML, /Retry/, 'failed message offers retry');
  await A.click(A.q('.msg.mine .bubble'));
  await waitFor(() => A.win.inko.Chat.byId(m.id).state === 'queued', { label: 'tap re-queues the message' });
  assert.match(A.text('toast'), /send it automatically/);
  close(A);
});

test('42. Long message is trimmed, html is escaped (no injection)', async () => {
  const bus = createBus();
  const { A, B } = await connectPair(bus);
  await A.click('openChat'); await B.click('openChat');
  A.type('chatInput', '<img src=x onerror="window.__pwned=1"> hi');
  await A.click('sendChat');
  await waitFor(() => B.win.inko.Chat.list.some(m => m.text.includes('onerror')), { label: 'delivered as text' });
  assert.equal(B.win.__pwned, undefined, 'no script execution from message content');
  assert.equal(B.qa('#chatMessages img').length, 0, 'no injected element');
  A.type('chatInput', 'x'.repeat(3000));
  await A.click('sendChat');
  const sent = A.win.inko.Chat.list[A.win.inko.Chat.list.length - 1];
  assert.equal(sent.text.length, 2000, 'message length capped');
  close(A, B);
});
