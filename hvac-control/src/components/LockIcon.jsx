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

      {/* Hasp - 50% smaller, centered at top */}
      <path
        d="M 9 12 L 9 9 C 9 7.34315 10.3431 6 12 6 C 13.6569 6 15 7.34315 15 9 L 15 12"
        stroke="currentColor"
        strokeWidth="2"
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

      {/* Hasp - 50% smaller, open to the right */}
      <path
        d="M 9 12 L 9 9 C 9 7.34315 10.3431 6 12 6 C 13.6569 6 15 7.34315 15 9 L 15 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
