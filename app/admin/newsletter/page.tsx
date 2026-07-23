import { redirect } from 'next/navigation';

// Renamed: the tab is about subscribers now, not just the newsletter.
export default function AdminNewsletterPage() {
  redirect('/admin/subscribers');
}
