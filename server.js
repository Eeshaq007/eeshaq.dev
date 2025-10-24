// server.js
// Simple proxy server with HTML rewriting (use responsibly)

const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const helmet = require('helmet');
const morgan = require('morgan');
const { URL } = require('url');

const app = express();
app.use(helmet());
app.use(morgan('combined'));

// CONFIG
const PORT = process.env.PORT || 3000;
// Allowed hostnames (only proxy requests to these hosts). Add hosts you trust.
// You can set an environment variable PROXY_ALLOWLIST with comma-separated hostnames
const envAllow = process.env.PROXY_ALLOWLIST || 'duckduckgo.com,example.com';
const ALLOWLIST = envAllow.split(',').map(h => h.trim()).filter(Boolean);

// helper: validate and normalize URL
function normalizeUrl(raw) {
  try {
    const url = new URL(raw);
    // only http(s)
    if (!/^https?:$/.test(url.protocol)) return null;
    return url;
  } catch (err) {
    return null;
  }
}

// helper: host allowed?
function hostAllowed(hostname) {
  if (!ALLOWLIST.length) return false;
  return ALLOWLIST.some(allowed => {
    // allow subdomains: example.com matches sub.example.com
    return hostname === allowed || hostname.endsWith('.' + allowed);
  });
}

app.get('/proxy', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).send('Missing url parameter');

  const url = normalizeUrl(raw);
  if (!url) return res.status(400).send('Invalid URL');

  if (!hostAllowed(url.hostname)) {
    return res.status(403).send('Host not allowed by proxy allowlist');
  }

  try {
    // Forward some headers from client
    const headers = { 'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0' };

    // Fetch the target
    const resp = await fetch(url.toString(), { headers, redirect: 'follow' });

    // Get content-type
    const contentType = resp.headers.get('content-type') || '';

    // If HTML, rewrite links so they go through our proxy
    if (contentType.includes('text/html')) {
      const text = await resp.text();
      const $ = cheerio.load(text, { decodeEntities: false });

      // rewrite <a href> to point to /proxy?url=<original>
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        try {
          // convert relative -> absolute
          const absolute = new URL(href, url.origin + url.pathname).toString();
          $(el).attr('href', `/proxy?url=${encodeURIComponent(absolute)}`);
          // ensure links open in same browsing context
          $(el).attr('target', '_self');
        } catch (e) {
          // ignore malformed hrefs
        }
      });

      // rewrite forms that post to relative urls -> absolute then proxy
      $('form[action]').each((i, el) => {
        const act = $(el).attr('action');
        try {
          const absolute = new URL(act, url.origin + url.pathname).toString();
          $(el).attr('action', `/proxy?url=${encodeURIComponent(absolute)}`);
          // ensure method is preserved, but we won't proxy post bodies in this minimal example
        } catch (e) {}
      });

      // set base tag so relative resources still resolve (optional)
      // You could also rewrite resource links (img, script, link) to proxy them if needed.
      $('head').prepend(`<base href="${url.origin}${url.pathname}">`);

      // send rewritten HTML
      res.set('content-type', 'text/html; charset=utf-8');
      res.send($.html());
      return;
    }

    // For non-HTML content, stream the response directly with original content type
    res.set('content-type', contentType);
    // copy other useful headers
    const cLen = resp.headers.get('content-length');
    if (cLen) res.set('content-length', cLen);

    // Pipe the response body
    const body = await resp.buffer();
    res.send(body);
  } catch (err) {
    console.error('Proxy error', err);
    res.status(502).send('Failed to fetch target URL');
  }
});

app.get('/', (req, res) => {
  res.send('Simple proxy server is running. Use /proxy?url=...');
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
  console.log('Allowlist:', ALLOWLIST);
});
