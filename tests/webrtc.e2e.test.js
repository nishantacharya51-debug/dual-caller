/**
 * E2E WebRTC test - mandatory
 * Tests: Browser A joins, Browser B joins, Browser C rejected
 * 
 * Run with: npx playwright test
 */

const { test, expect } = require('@playwright/test');

test.describe('InkoCaller E2E - 2-person enforcement', () => {
  test('Browser A creates call, B joins, C rejected', async ({ browser }) => {
    // Create 3 browser contexts to simulate 3 users
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    // A creates call via API
    const sessionRes = await pageA.request.post('http://localhost:3000/api/session');
    expect(sessionRes.ok()).toBeTruthy();
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.sessionId;
    expect(sessionId).toBeTruthy();
    console.log(`Session created: ${sessionId}`);

    // A joins call page
    await pageA.goto(`http://localhost:3000/call/${sessionId}`);
    await expect(pageA.locator('text=Ready to join?')).toBeVisible({ timeout: 10000 });

    // B joins same call
    await pageB.goto(`http://localhost:3000/call/${sessionId}`);
    await expect(pageB.locator('text=Ready to join?')).toBeVisible({ timeout: 10000 });

    // Check session has 0 participants initially (pre-call doesn't join)
    let sessionCheck = await pageA.request.get(`http://localhost:3000/api/session?id=${sessionId}`);
    let data = await sessionCheck.json();
    expect(data.participantCount).toBe(0);

    // Simulate socket join for A and B via API (since pre-call requires media)
    // For full E2E, we'd need to mock getUserMedia
    // Here we test the enforcement via direct socket.io client
    const io = require('socket.io-client');
    
    const socketA = io('http://localhost:3000', { auth: { sessionId } });
    const socketB = io('http://localhost:3000', { auth: { sessionId } });
    const socketC = io('http://localhost:3000', { auth: { sessionId } });

    const joinPromise = (socket) => new Promise((resolve) => {
      socket.emit('join-session', { sessionId }, (res) => resolve(res));
    });

    const resultA = await joinPromise(socketA);
    console.log('A join result:', resultA);
    expect(resultA.success).toBe(true);
    expect(resultA.participantCount).toBe(1);

    const resultB = await joinPromise(socketB);
    console.log('B join result:', resultB);
    expect(resultB.success).toBe(true);
    expect(resultB.participantCount).toBe(2);

    const resultC = await joinPromise(socketC);
    console.log('C join result (should be rejected):', resultC);
    expect(resultC.success).toBe(false);
    expect(resultC.reason).toBe('full');

    // Cleanup
    socketA.disconnect();
    socketB.disconnect();
    socketC.disconnect();
    
    await contextA.close();
    await contextB.close();
    await contextC.close();
  });

  test('landing page loads and has CTA', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.locator('text=Private calls.')).toBeVisible();
    await expect(page.locator('text=Start a Call').first()).toBeVisible();
  });

  test('health check passes', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/health');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.limits.participantsPerCall).toBe(2);
  });
});
