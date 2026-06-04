import { redirect } from 'next/navigation';

// The board now lives on /162-0 itself; keep the old deep link working.
export default function PlayRedirect() {
  redirect('/162-0');
}
