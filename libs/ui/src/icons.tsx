// libs/ui/src/icons.tsx — tiny inline SVG icon set (Heroicons-style, thin/regular) for WCM primitives.
// Centralizing them keeps a11y consistent (aria-hidden by default; they pair with text, never stand
// alone as the only signal) and avoids pulling a full icon dependency into the federated remote.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  width: 16,
  height: 16,
  viewBox: '0 0 20 20',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: false,
  ...props,
});

/** Pencil — DRAFT / editable. */
export function PencilIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a1 1 0 0 1-.464.263l-3 .857a.5.5 0 0 1-.617-.617l.857-3a1 1 0 0 1 .263-.464l8.5-8.5Z" />
    </svg>
  );
}

/** Lock — LOCKED / frozen. */
export function LockIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path
        fillRule="evenodd"
        d="M10 1a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V5a4 4 0 0 0-4-4Zm2 6V5a2 2 0 1 0-4 0v2h4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Arrows-cycle — RECONCILING / in progress. */
export function ReconcileIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path
        fillRule="evenodd"
        d="M10 3a7 7 0 0 0-6.3 3.95.75.75 0 1 0 1.35.65A5.5 5.5 0 0 1 15.5 10h-2l3 3.5L19.5 10h-2A7 7 0 0 0 10 3Zm-7.5 7 3-3.5L1 10h2a7 7 0 0 0 12.95 3.4.75.75 0 0 0-1.35-.65A5.5 5.5 0 0 1 4.5 10h2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Check-circle — RECONCILED / success / complete. */
export function CheckCircleIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Forward-arrow — CARRY_FORWARD. */
export function ForwardIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h8.69L9.22 6.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Exclamation-triangle — warning / past-due / blocking. */
export function WarningIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Chevron-right — collapsed tree node / breadcrumb separator. */
export function ChevronRightIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Chevron-down — expanded tree node. */
export function ChevronDownIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Spinner — generic loading affordance. */
export function SpinnerIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)} className={`animate-spin ${props.className ?? ''}`.trim()}>
      <path
        d="M10 3a7 7 0 1 0 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** X-mark — clear / close. */
export function XMarkIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}
