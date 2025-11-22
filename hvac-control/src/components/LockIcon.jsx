/**
 * Custom Lock Icons - SVG components for locked/unlocked states
 * Features a smaller hasp (50% size) centered over the lock body
 */

export function LockedIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Lock Body - positioned at bottom */}
      <rect
        x="6"
        y="12"
        width="12"
        height="10"
        rx="1.5"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Keyhole */}
      <circle
        cx="12"
        cy="16"
        r="1.5"
        fill="white"
      />
      <rect
        x="11"
        y="17"
        width="2"
        height="3"
        rx="0.5"
        fill="white"
      />

      {/* Hasp - much smaller (50% size), centered at top */}
      <path
        d="M 10 12 L 10 10 C 10 8.89543 10.8954 8 12 8 C 13.1046 8 14 8.89543 14 10 L 14 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function UnlockedIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Lock Body - positioned at bottom */}
      <rect
        x="6"
        y="12"
        width="12"
        height="10"
        rx="1.5"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Keyhole */}
      <circle
        cx="12"
        cy="16"
        r="1.5"
        fill="white"
      />
      <rect
        x="11"
        y="17"
        width="2"
        height="3"
        rx="0.5"
        fill="white"
      />

      {/* Hasp - much smaller (50% size), open to the right */}
      <path
        d="M 10 12 L 10 10 C 10 8.89543 10.8954 8 12 8 C 13.1046 8 14 8.89543 14 10 L 14 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
