/**
 * #436: explicit allowlist of remote avatar/image hosts.
 *
 * Must stay in sync with `images.remotePatterns` in next.config.mjs — a URL is
 * only rendered through next/image when it matches both lists. Anything else
 * (arbitrary user-supplied avatar URL) is rejected and the caller falls back to
 * a local initials avatar, so no unvetted host is ever proxied/optimised.
 *
 * To add a new provider avatar host safely:
 *  1. Add the exact hostname (and path prefix if the CDN is shared) here.
 *  2. Add the same entry to `images.remotePatterns` in next.config.mjs.
 *  3. Document it in docs/avatar-host-allowlist.md.
 */
export const ALLOWED_AVATAR_HOSTS: ReadonlyArray<{
  hostname: string;
  pathPrefix?: string;
}> = [
  { hostname: "api.dicebear.com", pathPrefix: "/7.x/" },
  { hostname: "avatars.githubusercontent.com" },
  { hostname: "secure.gravatar.com" },
  { hostname: "www.gravatar.com" },
];

/**
 * Returns true when `url` is an absolute HTTPS URL on an allowlisted avatar
 * host. Relative paths (local `/avatars/*.png`) are always allowed.
 */
export function isAllowedAvatarUrl(url?: string | null): url is string {
  if (!url) return false;
  if (url.startsWith("/")) return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  return ALLOWED_AVATAR_HOSTS.some(
    ({ hostname, pathPrefix }) =>
      parsed.hostname === hostname &&
      (!pathPrefix || parsed.pathname.startsWith(pathPrefix))
  );
}
