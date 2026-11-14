'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button, Input, Label } from '@/components/ui';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const { user, signIn } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) router.replace(new URLSearchParams(location.search).get('next') || '/'); }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await signIn(email, password); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <main className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-canvas md:block">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_10%,#ffffff_0%,#f4efe6_45%,#ebe5da_100%)]" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <Logo />
          <div className="max-w-md animate-fade-up">
            <Label className="mb-5">Your personal atelier</Label>
            <p className="display text-[64px]">See it on you before you buy.</p>
            <p className="mt-6 text-[15px] leading-relaxed text-muted">Bring in pieces from Vinted, SHEIN, Zara or ASOS, try them on your own photo with AI, and build outfits with a stylist that knows your wardrobe.</p>
          </div>
          <p className="label-xs">Private · Only you can see your photos</p>
        </div>
      </section>
      <section className="flex flex-col justify-center px-6 py-16 md:px-20">
        <div className="mx-auto w-full max-w-sm animate-fade-up">
          <Logo className="mb-16 md:hidden" />
          <Label className="mb-4">Welcome back</Label>
          <h1 className="display mb-10 text-[40px]">Sign in</h1>
          <form onSubmit={submit} className="space-y-5">
            <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">Continue</Button>
          </form>
          <p className="mt-10 text-[13px] leading-relaxed text-muted">This is a private wardrobe. Accounts are created by the owner in Supabase.</p>
        </div>
      </section>
    </main>
  );
}
