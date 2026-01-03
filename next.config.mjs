/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for Cloudflare Pages
  output: 'standalone',

  // Disable image optimization (not supported on Cloudflare Pages)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
