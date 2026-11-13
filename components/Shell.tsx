'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Home, Sparkles, Shirt, Layers, Images, UserRound } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Logo } from './Logo';
import { cx, Spinner } from './ui';

export const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/try-on', label: 'Try On', icon: Sparkles },
  { href: '/wardrobe', label: 'Wardrobe', long: 'My Wardrobe', icon: Shirt },
  { href: '/studio', label: 'Studio', long: 'Outfit Studio', icon: Layers },
  { href: '/looks', label: 'Looks', long: 'Saved Looks', icon: Images },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

export function Shell({ children }: { children: ReactNode }) {
  const { user, loaded, avatar, url, profile } = useStore();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { if (user === null) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [user, path, router]);

  if (!user || !loaded) {
    return <div className="grid min-h-dvh place-items-center"><div className="flex flex-col items-center gap-4"><Logo /><Spinner /></div></div>;
  }
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="min-h-dvh md:pl-64">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-white px-5 py-8 md:flex">
        <Link href="/" className="mb-12 px-3"><Logo /></Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, long, icon: Icon }) => (
            <Link key={href} href={href} className={cx('group flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] transition-all duration-300', active(href) ? 'bg-canvas text-ink' : 'text-muted hover:bg-canvas/60 hover:text-ink')}>
              <Icon className="size-[18px]" strokeWidth={1.5} />
              {long || label}
            </Link>
          ))}
        </nav>
        <Link href="/profile" className="mt-auto flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-canvas">
          <span className="size-9 overflow-hidden rounded-full bg-canvas">
            {avatar && url(avatar.path) && <img src={url(avatar.path)} alt="" className="size-full object-cover object-top" />}
          </span>
          <span className="min-w-0 text-[13px]">
            <span className="block truncate text-ink">{profile?.display_name || user.email}</span>
            <span className="text-muted">Private wardrobe</span>
          </span>
        </Link>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-white/85 px-5 backdrop-blur-xl md:hidden">
        <Link href="/"><Logo /></Link>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pb-32 pt-8 md:px-12 md:pb-20 md:pt-14">{children}</main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-6">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cx('flex h-16 flex-col items-center justify-center gap-1 text-[10px] tracking-wide transition-colors', active(href) ? 'text-ink' : 'text-muted')}>
              <Icon className="size-[21px]" strokeWidth={active(href) ? 1.8 : 1.4} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
