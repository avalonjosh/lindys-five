'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function NewsletterVerified() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('newsletter');
    if (status === 'success') {
      localStorage.setItem('newsletter-subscribed', '1');
    }
  }, [searchParams]);

  return null;
}
