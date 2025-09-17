// Next.js App Router dynamic sitemap
import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://vinops.online"
  const now = new Date()
  return [
    { url: `${base}/`,       lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/en`,     lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/en/cars`,lastModified: now, changeFrequency: "daily",  priority: 0.8 },
  ]
}
