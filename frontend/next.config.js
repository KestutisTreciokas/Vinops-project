/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Примечание: HSTS лучше включать на прокси. Если требуется на app, раскомментируйте:
          // { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ]
  },
  experimental: {
    // сохраняем принятые ранее решения
    typedRoutes: true,
  },
}
module.exports = nextConfig
