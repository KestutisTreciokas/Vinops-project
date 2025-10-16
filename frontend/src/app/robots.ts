import type { MetadataRoute } from 'next'

const siteUrl = 'https://vinops.online'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // служебные эндпоинты обоих языков
        disallow: ['/*/health'],
      },
    ],
    // В S1 публикуется только корневой sitemap. VIN-шарды будут в S3.
    sitemap: `${siteUrl}/sitemap.xml`,
    host: 'vinops.online',
  }
}
