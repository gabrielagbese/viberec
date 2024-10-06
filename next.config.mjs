/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/t/p/**', // This covers the TMDB image paths.
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/tmdb/:path*',
        destination: 'https://image.tmdb.org/t/p/:path*', // Proxy to TMDB images
      },
    ];
  },
};

export default nextConfig;
