import { defineMiddleware } from "astro:middleware";
import shells from "./data/shells.json";

const FILE_EXTENSION_PATTERN = /\.[a-z0-9]+$/i;
const PUBLIC_HTML_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const EDGE_HTML_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";
const PRIVATE_CACHE_CONTROL = "no-store, max-age=0";
const HTML_CACHE_VERSION = "2026-06-13-dynamic-team-v2";
const STATIC_PATHS = [
  "/",
  "/about/",
  "/audiologist-hearing-aids-arvada-colorado/",
  "/audiologist-hearing-aids-littleton-colorado/",
  "/contact-us/",
  "/sitemap/"
];
const CONTENT_PATHS = Object.entries(shells).flatMap(([collection, entries]) =>
  Object.keys(entries).map((slug) => `/${slug}/`)
);
const SITEMAP_PATHS = Array.from(new Set([...STATIC_PATHS, ...CONTENT_PATHS])).sort();

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const createSitemap = (origin: string) => {
  const urls = SITEMAP_PATHS
    .map((pathname) => `  <url>\n    <loc>${escapeXml(`${origin}${pathname}`)}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const isPrivatePath = (pathname: string) =>
  pathname.startsWith("/_emdash/") ||
  pathname.startsWith("/api/") ||
  pathname.startsWith("/uploads/");

const isHtmlResponse = (response: Response) =>
  (response.headers.get("Content-Type") || "").toLowerCase().includes("text/html");

const getHtmlCacheKey = (url: URL) => {
  const cacheUrl = new URL(url);
  cacheUrl.search = "";
  cacheUrl.searchParams.set("__html_cache_version", HTML_CACHE_VERSION);
  return new Request(cacheUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "text/html"
    }
  });
};

const canCacheHtmlRequest = (method: string, pathname: string) =>
  method === "GET" &&
  !isPrivatePath(pathname) &&
  !FILE_EXTENSION_PATTERN.test(pathname);

const getWorkerCache = () => {
  const runtime = globalThis as typeof globalThis & { caches?: CacheStorage };
  return runtime.caches?.default;
};

const withWorkerCacheStatus = (response: Response, status: "HIT" | "MISS" | "BYPASS") => {
  const headers = new Headers(response.headers);
  headers.set("X-NewLeaf-Worker-Cache", status);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

const applyPublicHtmlCacheHeaders = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", PUBLIC_HTML_CACHE_CONTROL);
  headers.set("CDN-Cache-Control", EDGE_HTML_CACHE_CONTROL);
  headers.set("Cloudflare-CDN-Cache-Control", EDGE_HTML_CACHE_CONTROL);
  headers.set("Vary", "Accept-Encoding");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

const applyPrivateCacheHeaders = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
  headers.delete("CDN-Cache-Control");
  headers.delete("Cloudflare-CDN-Cache-Control");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const method = context.request.method.toUpperCase();
  const workerCache = canCacheHtmlRequest(method, pathname) ? getWorkerCache() : undefined;
  const htmlCacheKey = workerCache ? getHtmlCacheKey(context.url) : undefined;

  if (workerCache && htmlCacheKey) {
    const cachedResponse = await workerCache.match(htmlCacheKey);
    if (cachedResponse) {
      return withWorkerCacheStatus(cachedResponse, "HIT");
    }
  }

  if (pathname === "/sitemap.xml") {
    return new Response(createSitemap(context.url.origin), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": PUBLIC_HTML_CACHE_CONTROL,
        "CDN-Cache-Control": EDGE_HTML_CACHE_CONTROL,
        "Cloudflare-CDN-Cache-Control": EDGE_HTML_CACHE_CONTROL
      }
    });
  }

  if (
    pathname !== "/" &&
    !pathname.endsWith("/") &&
    !pathname.startsWith("/_emdash/") &&
    !FILE_EXTENSION_PATTERN.test(pathname)
  ) {
    const url = new URL(context.url);
    url.pathname = `${pathname}/`;
    const response = context.redirect(url, 301);
    response.headers.set("Cache-Control", PUBLIC_HTML_CACHE_CONTROL);
    response.headers.set("CDN-Cache-Control", EDGE_HTML_CACHE_CONTROL);
    response.headers.set("Cloudflare-CDN-Cache-Control", EDGE_HTML_CACHE_CONTROL);
    return response;
  }

  const response = await next();

  if (method !== "GET" && method !== "HEAD") {
    return applyPrivateCacheHeaders(response);
  }

  if (isPrivatePath(pathname) || response.headers.has("Set-Cookie")) {
    return applyPrivateCacheHeaders(response);
  }

  if (response.status === 200 && isHtmlResponse(response)) {
    const cacheableResponse = applyPublicHtmlCacheHeaders(response);

    if (workerCache && htmlCacheKey) {
      context.locals.cfContext?.waitUntil(
        workerCache.put(htmlCacheKey, cacheableResponse.clone()).catch((error) => {
          console.error("Failed to cache HTML response", error);
        })
      );
      return withWorkerCacheStatus(cacheableResponse, "MISS");
    }

    return withWorkerCacheStatus(cacheableResponse, "BYPASS");
  }

  return response;
});
