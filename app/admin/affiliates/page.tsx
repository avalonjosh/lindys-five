import { redirect } from 'next/navigation';

// The Affiliates tab is now Earnings (affiliates plus Ko-fi tips).
export default function AdminAffiliatesPage() {
  redirect('/admin/earnings');
}
