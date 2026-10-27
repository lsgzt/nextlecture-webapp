import { useEffect, useState } from "react";
import { facultyInitials } from "@/lib/faculty-directory";

/**
 * Circular faculty photo with the two-letter initials fallback — the same
 * behaviour as the Android app's FacultyAvatar: initials sit underneath the
 * stream-in photo (and stay forever for the handful of teachers whose
 * official page carries no picture), so rows never jump in height. The
 * photo itself loads straight from gndec.ac.in, exactly like the app.
 */
export function FacultyAvatar({
  name,
  imageUrl,
  className = "",
  size = "h-10 w-10",
  onPhotoClick,
}: {
  name: string;
  imageUrl?: string;
  className?: string;
  size?: string;
  /** Invoked only when there IS a photo to open. */
  onPhotoClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const showPhoto = imageUrl && !failed;
  const initials = facultyInitials(name);
  const isButton = Boolean(showPhoto && onPhotoClick);

  const content = showPhoto ? (
    <img
      src={imageUrl}
      alt={`${name.trim()} photo`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full rounded-full object-cover"
      draggable={false}
    />
  ) : (
    <span className="text-sm font-bold leading-none">{initials}</span>
  );

  const base = `grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-teal-700/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 ${className}`;

  return isButton ? (
    <button type="button" onClick={onPhotoClick} aria-label={`Open ${name.trim()} photo`} className={`${base} cursor-zoom-in`}>
      {content}
    </button>
  ) : (
    <span className={base} aria-hidden={showPhoto ? undefined : true}>
      {content}
    </span>
  );
}
