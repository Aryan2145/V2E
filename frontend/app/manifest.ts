import type { MetadataRoute } from 'next'

// PWA manifest — lets users install V2E to their phone's home screen
// (required for mobile push notifications) and to the desktop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'V2E — Organisation OS',
    short_name: 'V2E',
    description: 'The operating system for your organisation',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#2563EB',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
