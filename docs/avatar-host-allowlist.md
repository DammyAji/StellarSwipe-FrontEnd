# Avatar / image host allowlist (#436)

`next.config.mjs` no longer uses the wildcard `hostname: "**"` for
`images.remotePatterns`. Only the hosts below may be optimised by `next/image`:

| Host | Path scope | Used by |
| --- | --- | --- |
| `api.dicebear.com` | `/7.x/**` | Generated avatars (leaderboard, provider profiles) |
| `avatars.githubusercontent.com` | any | GitHub-linked provider profiles |
| `secure.gravatar.com` | any | Email-derived avatars |
| `www.gravatar.com` | any | Email-derived avatars |

## Arbitrary user-supplied avatar URLs

Avatar URLs come from user/provider data and are therefore untrusted. The
mitigation is a **validated allowlist + local fallback**:

- `lib/avatarHosts.ts` exports `isAllowedAvatarUrl()`, which accepts only
  relative paths (`/avatars/...`) and absolute HTTPS URLs whose hostname (and
  path prefix, where scoped) matches the allowlist above.
- `components/AvatarImage.tsx` runs every `src` through that check. Rejected
  URLs are never passed to `next/image`; the component renders the local
  initials avatar instead, so no unvetted host is proxied or optimised.

## Adding a new provider avatar host safely

1. Add the exact hostname (plus a path prefix if the CDN is shared with
   unrelated content) to `ALLOWED_AVATAR_HOSTS` in `lib/avatarHosts.ts`.
2. Add the identical entry to `images.remotePatterns` in `next.config.mjs`.
3. Add a row to the table above.
4. Never add a wildcard hostname (`**`, `*.example.com`) unless the wildcard is
   scoped to a subdomain you control.
