/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Everything is processed client-side; no remote images or server uploads.
  images: { remotePatterns: [] },
};

export default nextConfig;
