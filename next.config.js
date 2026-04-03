/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '200mb' },
  },
  api: {
    bodyParser: { sizeLimit: '200mb' },
    responseLimit: '200mb',
  },
};
module.exports = nextConfig;