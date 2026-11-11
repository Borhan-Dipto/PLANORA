/** PLANORA's brand mark: a true 3D-beveled amber badge with a checklist glyph, used in place of
 * the old plain "P" letter everywhere the brand appears (sidebar, mobile header, auth pages, app
 * icons). Built from a bottom shadow slab + a lifted, bevelled top face so it reads as a solid
 * tile rather than a flat icon with a gradient — pure inline SVG, crisp at every size, no image
 * asset needed. */
export function Logomark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="planoraFace" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="var(--accent-light)" />
          <stop offset="0.55" stopColor="var(--accent)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--accent) 70%, #000000)" />
        </linearGradient>
        <linearGradient id="planoraEdge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--accent) 55%, #000000)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--accent) 30%, #000000)" />
        </linearGradient>
        <radialGradient id="planoraSheen" cx="0.28" cy="0.22" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="planoraFaceClip">
          <rect x="2" y="1" width="36" height="36" rx="9.5" />
        </clipPath>
      </defs>

      {/* Bottom edge — a darker slab peeking out below/right of the top face, reading as depth. */}
      <rect x="3.4" y="4" width="36" height="36" rx="9.5" fill="url(#planoraEdge)" />

      {/* Top face — lifted up-left of the edge slab, bevelled with an inner sheen. */}
      <g clipPath="url(#planoraFaceClip)">
        <rect x="2" y="1" width="36" height="36" fill="url(#planoraFace)" />
        <rect x="2" y="1" width="36" height="36" fill="url(#planoraSheen)" />
        <rect x="2.6" y="1.6" width="34.8" height="34.8" rx="9" fill="none" stroke="#ffffff" strokeOpacity="0.22" />
      </g>
      <rect x="2" y="1" width="36" height="36" rx="9.5" fill="none" stroke="color-mix(in srgb, var(--accent) 65%, #000000)" strokeWidth="0.6" />

      {/* Checklist glyph: two done items + one in progress — the "planning" motif. */}
      <g transform="translate(0, -0.6)">
        <path d="M12.5 15.3 L14.6 17.4 L18.8 13" stroke="var(--accent-foreground)" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="21" y="14.85" width="8.3" height="2.3" rx="1.15" fill="var(--accent-foreground)" fillOpacity="0.88" />
        <path d="M12.5 22.3 L14.6 24.4 L18.8 20" stroke="var(--accent-foreground)" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="21" y="21.85" width="8.3" height="2.3" rx="1.15" fill="var(--accent-foreground)" fillOpacity="0.88" />
        <rect x="12.5" y="28.85" width="6" height="2.3" rx="1.15" fill="var(--accent-foreground)" fillOpacity="0.45" />
      </g>
    </svg>
  );
}
