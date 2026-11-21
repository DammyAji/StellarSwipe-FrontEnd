"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { isAllowedAvatarUrl } from "@/lib/avatarHosts";

interface AvatarImageProps {
  /** Remote image URL. Empty/undefined triggers the fallback immediately. */
  src?: string | null;
  /**
   * Human-readable name for the avatar owner.
   * Used to derive the accessible alt text and the initials fallback.
   * Pass an empty string for decorative avatars (e.g. anonymous users) —
   * the element will be marked aria-hidden.
   */
  name: string;
  /** Pixel size in the layout (both width and height). Defaults to 40. */
  size?: number;
  /** Additional classes forwarded to the outer container. */
  className?: string;
  /**
   * Load eagerly with high fetch priority. Use for above-the-fold artwork;
   * everything else is lazy-loaded.
   */
  priority?: boolean;
  /** next/image quality value (1–100). Defaults to 75. */
  quality?: number;
}

/**
 * AvatarImage — #564 image loading fallback for user avatars.
 *
 * - Reserves space via fixed dimensions so surrounding layout never shifts.
 * - Shows a subtle skeleton shimmer while the remote image loads.
 * - On error (missing/broken URL) renders initials in a coloured circle,
 *   matching the user's name for visual consistency.
 * - Alt text reflects the owner's name or is empty+aria-hidden for decorative use.
 */
export function AvatarImage({
  src,
  name,
  size = 40,
  className,
  quality = 75,
  priority = false,
}: AvatarImageProps) {
  // #436: only allowlisted hosts may be optimised by next/image; anything else
  // (arbitrary user-supplied URL) falls back to the initials avatar.
  const safeSrc = isAllowedAvatarUrl(src) ? src : null;

  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    safeSrc ? "loading" : "error"
  );

  // Reset when the artwork URL changes so a new image gets its own placeholder.
  useEffect(() => {
    setStatus(safeSrc ? "loading" : "error");
  }, [safeSrc]);

  const isDecorative = name === "";
  const initials = deriveInitials(name);
  const bgColor = deriveHslColor(name);

  const sizePx = size;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className
      )}
      style={{ width: sizePx, height: sizePx }}
      aria-hidden={isDecorative || undefined}
    >
      {/* Skeleton shimmer while loading */}
      {status === "loading" && (
        <span
          className="skeleton-shimmer absolute inset-0 rounded-full bg-muted"
          aria-hidden="true"
        />
      )}

      {/* Actual remote image */}
      {safeSrc && status !== "error" && (
        <Image
          src={safeSrc}
          alt={isDecorative ? "" : `${name} avatar`}
          width={sizePx}
          height={sizePx}
          quality={quality}
          className={cn(
            "rounded-full object-cover transition-opacity duration-200",
            status === "loaded" ? "opacity-100" : "opacity-0"
          )}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          sizes={`${sizePx}px`}
        />
      )}

      {/* Initials fallback when broken or missing */}
      {status === "error" && (
        <span
          className="flex h-full w-full items-center justify-center rounded-full text-white select-none"
          style={{
            background: bgColor,
            fontSize: Math.max(sizePx * 0.35, 10),
            fontWeight: 600,
          }}
          aria-hidden={isDecorative || undefined}
        >
          {isDecorative ? "?" : initials}
        </span>
      )}
    </span>
  );
}

/** Extract up to two initials from a name string. */
function deriveInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic HSL colour derived from a name string. */
function deriveHslColor(name: string): string {
  if (!name) return "hsl(220, 14%, 46%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}
