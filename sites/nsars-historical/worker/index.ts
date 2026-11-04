/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  requestWithAdminSession,
  requestWithoutTrustedAdminHeaders,
  type AdminRuntimeBindings,
} from "../lib/admin-session";

interface Env extends AdminRuntimeBindings {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET?: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.hostname === "ns-ars-production.ru" ||
      url.hostname.endsWith(".ns-ars-production.ru")
    ) {
      return withSecurityHeaders(
        new Response("Misdirected request", { status: 421 }),
        url,
      );
    }

    if (url.pathname === "/robots.txt" || url.pathname === "/robots.txt/") {
      return withSecurityHeaders(
        new Response(
          [
            "User-agent: *",
            "Disallow: /",
            "Sitemap: https://ns-ars.ru/sitemap.xml/",
            "",
          ].join("\n"),
          {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          },
        ),
        url,
      );
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(response, url);
    }

    const applicationRequest = isProtectedSurface(url)
      ? await requestWithAdminSession(request, env)
      : requestWithoutTrustedAdminHeaders(request);
    const response = await handler.fetch(applicationRequest, env, ctx);
    return withSecurityHeaders(response, url);
  },
};

function isProtectedSurface(url: URL) {
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (
    pathname === "/api/admin/auth/login" ||
    pathname === "/api/admin/auth/logout" ||
    pathname === "/admin/login"
  ) {
    return false;
  }
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/") ||
    pathname === "/preview" ||
    pathname === "/qa-responsive" ||
    (pathname.startsWith("/api/media/") && url.searchParams.get("preview") === "1")
  );
}

function withSecurityHeaders(response: Response, url: URL): Response {
  if (response.status === 101) return response;
  const secured = new Response(response.body, response);
  const hostname = url.hostname;
  const localPreview = hostname === "terminal.local" || hostname === "localhost";
  const qaFrame = localPreview && url.searchParams.get("qa_frame") === "1";
  const qaHarness = localPreview && url.pathname.replace(/\/$/, "") === "/qa-responsive";
  const scriptPolicy = localPreview
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  secured.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptPolicy,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      localPreview ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
      "font-src 'self' data:",
      "media-src 'none'",
      "object-src 'none'",
      qaHarness ? "frame-src 'self'" : "frame-src 'none'",
      qaFrame ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(localPreview ? [] : ["upgrade-insecure-requests"]),
    ].join("; "),
  );
  secured.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  secured.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  secured.headers.set("Cache-Control", "no-store, max-age=0");
  secured.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  secured.headers.set("X-Content-Type-Options", "nosniff");
  secured.headers.set("X-Frame-Options", qaFrame ? "SAMEORIGIN" : "DENY");
  secured.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return secured;
}

export default worker;
