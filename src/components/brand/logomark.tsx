/** PLANORA's brand mark: a glossy, 3D-tinted badge with a checklist glyph — used in place of the
 * old plain "P" letter everywhere the brand appears (sidebar, mobile header, auth pages). Pure
 * inline SVG so it stays crisp at every size and needs no separate image asset. */
export function Logomark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="planoraBadgeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--accent) 55%, #000000)" />
        </linearGradient>
        <clipPath id="planoraBadgeClip">
          <rect x="2" y="2" width="36" height="36" rx="9" />
        </clipPath>
      </defs>

      <g clipPath="url(#planoraBadgeClip)">
        <rect x="2" y="2" width="36" height="36" fill="url(#planoraBadgeGrad)" />
        {/* Glossy highlight — the "3D" sheen across the top-left. */}
        <ellipse cx="13" cy="8" rx="22" ry="11" fill="#ffffff" opacity="0.18" />
        <rect x="2" y="2" width="36" height="36" fill="none" stroke="#ffffff" strokeOpacity="0.1" />
      </g>

      {/* Checklist glyph: two done items + one in progress — the "planning" motif. */}
      <path d="M12.5 15.3 L14.6 17.4 L18.8 13" stroke="#ffffff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21" y="14.9" width="8.3" height="2.2" rx="1.1" fill="#ffffff" fillOpacity="0.92" />
      <path d="M12.5 22.3 L14.6 24.4 L18.8 20" stroke="#ffffff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21" y="21.9" width="8.3" height="2.2" rx="1.1" fill="#ffffff" fillOpacity="0.92" />
      <rect x="12.5" y="28.9" width="6" height="2.2" rx="1.1" fill="#ffffff" fillOpacity="0.5" />
    </svg>
  );
}
