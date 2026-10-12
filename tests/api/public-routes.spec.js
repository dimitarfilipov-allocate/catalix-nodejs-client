const { test, expect } = require('../fixtures/auth-fixtures');

test.describe('Public and Lifecycle Routes', () => {
  test('GET / returns 200 with the public landing page HTML', async ({ request }) => {
    const response = await request.get('/');

    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('Catalix Demo');
    expect(html).toContain('Node.js application with Catalix Authentication');
    expect(html).toContain('/dashboard');
  });

  test('GET /logout returns 302 redirecting to configured logout path prefix', async ({ request }) => {
    const response = await request.get('/logout', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);
    const location = response.headers()['location'];
    expect(location).toBe('/DEV/NOD/Logout');
  });

  test('GET /logged-out returns 200 with the logout confirmation page HTML', async ({ request }) => {
    const response = await request.get('/logged-out');

    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('Logged Out');
  });
});
