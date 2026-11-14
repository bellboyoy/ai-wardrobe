'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Receives links shared from other apps (Android share sheet, or an iOS Shortcut) and opens "Add piece".
export default function SharePage() {
  const router = useRouter();
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const link = q.get('url') || (q.get('text') || '').match(/https?:\/\/\S+/)?.[0] || '';
    router.replace(link ? `/wardrobe?add=${encodeURIComponent(link)}` : '/wardrobe');
  }, [router]);
  return null;
}
