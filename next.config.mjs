/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // epub.js expects a browser-like environment; keep client-side only.
    return config;
  },
};

export default nextConfig;
