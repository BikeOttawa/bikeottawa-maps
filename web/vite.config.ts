import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { loadRegion, siteFiles } from '../regions/region.mjs'
import { oldPageHtml } from './src/oldSite'

// The region the site is built for.
const { dir, region } = loadRegion()
const OLD_PAGES = region.oldPages ?? {}
const OLD_PATHS = Object.keys(OLD_PAGES)

/** A page at each of the old site's paths, so its links still land on the right map. */
const oldSitePages = (): Plugin => ({
  name: 'old-site-pages',
  apply: 'build',
  generateBundle() {
    for (const [path, to] of Object.entries(OLD_PAGES)) {
      this.emitFile({ type: 'asset', fileName: `${path}/index.html`, source: oldPageHtml(to, region.title.en) })
    }
  },
})

const TYPES: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', geojson: 'application/geo+json' }

/** The region's logo and icons at the top of the site, its data under data/, and its name in the page. */
const regionFiles = (): Plugin => ({
  name: 'region-files',
  // A roadwork source the region names has to be there, or its overlay would stay empty.
  async buildStart() {
    for (const name of region.roadwork ?? []) {
      const file = `src/roadwork/sources/${name}.ts`
      if (!(await this.resolve(`/${file}`)))
        this.error(`region.json names the roadwork source "${name}": web/${file} is missing`)
    }
  },
  transformIndexHtml: (html) =>
    html.replaceAll('%REGION_TITLE%', region.title.en).replaceAll('%REGION_DESCRIPTION%', region.description),
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const name = ((req as { url?: string }).url ?? '').slice(server.config.base.length).split('?')[0]
      const file = siteFiles(dir)[name]
      if (!file) return next()
      res.setHeader('Content-Type', TYPES[name.split('.').at(-1) ?? ''] ?? 'application/octet-stream')
      res.end(file)
    })
  },
  generateBundle() {
    for (const [fileName, source] of Object.entries(siteFiles(dir))) this.emitFile({ type: 'asset', fileName, source })
  },
})

export default defineConfig({
  resolve: { alias: { '@region': dir.replace(/\/$/, '') } },
  plugins: [
    react(),
    oldSitePages(),
    regionFiles(),
    // Installable app: a manifest, and a service worker that keeps the app's own
    // files so it opens at once (and offline). Map tiles, routing and search
    // always go to the network.
    VitePWA({
      // A new version waits until the app is closed, rather than reloading it mid-use.
      registerType: 'prompt',
      injectRegister: 'script-defer',
      // The icons already match the pre-store patterns below; listing them twice is a Workbox error risk.
      includeManifestIcons: false,
      manifest: {
        name: region.title.en,
        short_name: region.shortTitle,
        description: region.description,
        lang: 'en',
        display: 'standalone',
        theme_color: '#0B6E6E',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webp}'],
        globIgnores: ['tiles/**', 'data/**', 'basemap-assets/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        // The old site's paths go to their own pages, not to the app; so does the way back from OSM's sign-in.
        navigateFallbackDenylist: [
          ...(OLD_PATHS.length ? [new RegExp(`/(${OLD_PATHS.join('|')})(/(index\\.html)?)?(\\?|$)`)] : []),
          /\/land\.html(\?|$)/,
        ],
        runtimeCaching: [
          {
            // Basemap fonts and icons: kept once fetched, refreshed in the background.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/basemap-assets/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'basemap-assets', expiration: { maxEntries: 500 } },
          },
          {
            // The data date and the collisions: fresh when online, the last copy when not.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/(tiles\/meta\.json|data\/)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'data', expiration: { maxEntries: 10 } },
          },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
