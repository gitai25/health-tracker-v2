// Cloudflare Worker for scheduled token refresh and data sync
// Deploy separately: wrangler deploy workers/cron-refresh.js --name health-tracker-cron

export default {
  async scheduled(event, env, ctx) {
    const url = env.PAGES_URL || 'https://health-tracker-v2.pages.dev';
    const secret = env.CRON_SECRET || '';
    const results = {};

    // 1. Refresh OAuth tokens
    try {
      const tokenResponse = await fetch(`${url}/api/cron/refresh-tokens`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'User-Agent': 'Cloudflare-Cron/1.0',
        },
      });
      results.tokens = await tokenResponse.json();
    } catch (error) {
      results.tokens = { error: error.message };
    }

    // 2. Sync data to D1
    try {
      const syncResponse = await fetch(`${url}/api/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'User-Agent': 'Cloudflare-Cron/1.0',
          'Content-Type': 'application/json',
        },
      });
      results.sync = await syncResponse.json();
    } catch (error) {
      results.sync = { error: error.message };
    }

    console.log('Cron job result:', JSON.stringify(results));
    return results;
  },

  // Also handle HTTP requests for testing
  async fetch(request, env) {
    return new Response(JSON.stringify({
      message: 'This worker runs every 30 minutes to refresh tokens and sync data',
      endpoints: [
        `${env.PAGES_URL || 'https://health-tracker-v2.pages.dev'}/api/cron/refresh-tokens`,
        `${env.PAGES_URL || 'https://health-tracker-v2.pages.dev'}/api/sync`,
      ],
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
