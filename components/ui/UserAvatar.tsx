"use client";

import { useMemo, useState } from "react";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  className?: string;
}

function getInitials(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (email?.trim()[0] ?? "U").toUpperCase();
}

export default function UserAvatar({ src, name, email, className }: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = useMemo(() => getInitials(name, email), [name, email]);
  const imageSrc = src?.trim();
  const showImage = !!imageSrc && failedSrc !== imageSrc;

  return (
    <div className={className} aria-label={name ?? email ?? "User"}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={name ?? email ?? "User"}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          onError={() => setFailedSrc(imageSrc)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}
