// Injects Open Graph / Twitter meta tags into the SPA's index.html. Crawlers don't
// run the app's JS, so the tags must be present in the served HTML — this does that
// at the edge. Regular visitors get the same HTML plus the tags, then the SPA boots
// normally. Shared by the preview edge functions.

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildTags(meta, canonicalUrl) {
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="BuildUVS">`,
    `<meta property="og:url" content="${esc(canonicalUrl)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta name="twitter:title" content="${esc(meta.title)}">`,
    // Decklist images are the portrait character card, so the small square card
    // by default; a page that is about the image can ask for the big one.
    `<meta name="twitter:card" content="${meta.twitterCard || 'summary'}">`,
  ]
  if (meta.description) {
    tags.push(
      `<meta name="description" content="${esc(meta.description)}">`,
      `<meta property="og:description" content="${esc(meta.description)}">`,
      `<meta name="twitter:description" content="${esc(meta.description)}">`,
    )
  }
  if (meta.image) {
    tags.push(
      `<meta property="og:image" content="${esc(meta.image)}">`,
      `<meta name="twitter:image" content="${esc(meta.image)}">`,
      `<meta property="og:image:alt" content="${esc(meta.title)}">`,
    )
  }
  tags.push(`<title>${esc(meta.title)}</title>`)
  return tags.join('\n    ')
}

/**
 * The response with `meta`'s tags in its <head>, or unchanged when there's no meta
 * (nothing richer than the site default to show) or it isn't HTML.
 *
 * @param {Response} res
 * @param {{title:string, description?:string, image?:string, twitterCard?:string}|null} meta
 * @param {string} canonicalUrl
 */
export async function withPreviewTags(res, meta, canonicalUrl) {
  if (!meta || !(res.headers.get('content-type') || '').includes('text/html')) return res

  let html = await res.text()
  // Drop the static <title> and any static description so ours are authoritative.
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')

  const injected = html.replace(/<\/head>/i, `    ${buildTags(meta, canonicalUrl)}\n  </head>`)

  const headers = new Headers(res.headers)
  headers.delete('content-length') // body length changed
  return new Response(injected, { status: res.status, headers })
}
