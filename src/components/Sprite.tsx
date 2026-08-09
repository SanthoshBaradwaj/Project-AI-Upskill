/**
 * The whole icon vocabulary: one circle and one 45-degree line. No icon library.
 * Inlined once immediately after <body>; referenced with <Icon name="..." />.
 */
export function Sprite() {
  return (
    <svg style={{ display: "none" }} aria-hidden="true">
      <symbol id="i-mark" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M8.5,21.5 L15.5,21.5 L23,13"
          fill="none"
          stroke="#6034FF"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="15.5" cy="21.5" r="3.1" fill="#FFB020" />
      </symbol>

      <symbol id="i-doc" viewBox="0 0 24 24">
        <path
          d="M6,3 h8 l4,4 v14 h-12 z M14,3 v4 h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M9,13 h6 M9,17 h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </symbol>

      <symbol id="i-filter" viewBox="0 0 24 24">
        <path
          d="M3,5 h18 l-7,8 v7 l-4-2.5 v-4.5 z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </symbol>

      <symbol id="i-check" viewBox="0 0 24 24">
        <path
          d="M4,12.5 L9.5,18 L20,6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>

      <symbol id="i-node" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      </symbol>

      <symbol id="i-route" viewBox="0 0 24 24">
        <path
          d="M4,19 L11,19 L20,10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="4" cy="19" r="2.6" fill="currentColor" />
        <circle cx="20" cy="10" r="2.6" fill="currentColor" />
      </symbol>

      <symbol id="i-arrow" viewBox="0 0 24 24">
        <path
          d="M4,12 h15 M13,6 l6,6 l-6,6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>

      <symbol id="i-x" viewBox="0 0 24 24">
        <path
          d="M6,6 L18,18 M18,6 L6,18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </symbol>
    </svg>
  );
}

export function Icon({
  name,
  size,
  className,
}: {
  name: "mark" | "doc" | "filter" | "check" | "node" | "route" | "arrow" | "x";
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      style={size ? { width: size, height: size } : undefined}
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}
