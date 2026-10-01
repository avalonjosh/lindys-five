'use client';

import { useEffect, useState } from 'react';
import EmailPreferences from './EmailPreferences';

/** /email-preferences?id=... from an email's unsubscribe link: no sign-in needed. */
export default function EmailPreferencesPage() {
  // undefined = not read yet, null = no id in the link
  const [id, setId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('id'));
  }, []);

  if (id === undefined) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!id) return <p className="text-sm text-slate-300">Open this page from the &quot;Unsubscribe&quot; link at the bottom of any Lindy&apos;s Five email, or sign in and use Settings on your account page.</p>;
  return <EmailPreferences id={id} />;
}
