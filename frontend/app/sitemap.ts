import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sculra.com';
  
  const routes = [
    '',
    '/features',
    '/pricing',
    '/enterprise',
    '/docs',
    '/blog',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/status'
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/status' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : route === '/features' || route === '/pricing' ? 0.8 : 0.5,
  }));
}
