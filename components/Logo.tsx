export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 100 100" className="size-7" aria-hidden>
        <rect width="100" height="100" rx="26" fill="#171717" />
        <path d="M50 30a6 6 0 1 1 6 6c-3.5 0-6 1.8-6 5v2.5l26 15.5c2.6 1.6 1.6 6-1.6 6H25.6c-3.2 0-4.2-4.4-1.6-6l26-15.5" fill="none" stroke="#F4EFE6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[17px] font-medium tracking-[-0.02em]">Atelier</span>
    </span>
  );
}
