/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'", // unsafe-eval нужен Next.js в dev
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com",
      "connect-src 'self' api-free.deepl.com api.deepl.com",
    ].join('; '),
  },
];

const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  api: {
    bodyParser: {
      sizeLimit: '1000mb',
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: '1000mb' },
  },
};

module.exports = nextConfig;