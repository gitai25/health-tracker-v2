// Cloudflare Worker for scheduled token refresh
// Deploy separately: wrangler deploy workers/cron-refresh.js --name health-tracker-cron

export default {
  async scheduled(event, env, ctx) {
    const url = env.PAGES_URL || 'https://health-tracker-v2.pages.dev';
    const secret = env.CRON_SECRET || '';

    try {
      const response = await fetch(`${url}/api/cron/refresh-tokens`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'User-Agent': 'Cloudflare-Cron/1.0',
        },
      });

      const result = await response.json();
      console.log('Token refresh result:', JSON.stringify(result));

      return result;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  },

  // Also handle HTTP requests for testing
  async fetch(request, env) {
    return new Response(JSON.stringify({
      message: 'This worker runs on a schedule to refresh OAuth tokens',
      endpoint: `${env.PAGES_URL || 'https://health-tracker-v2.pages.dev'}/api/cron/refresh-tokens`,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
