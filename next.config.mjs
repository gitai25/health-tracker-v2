/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization (not supported on Cloudflare Pages)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
