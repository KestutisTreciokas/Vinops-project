/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS оставляем на прокси (Caddy). Если понадобится на app — включим в отдельном мини-спринте.
        ],
      },
    ]
  },
  experimental: {
    typedRoutes: true,
  },
}
export default nextConfig
