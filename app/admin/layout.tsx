import type { Metadata } from 'next';
import AdminAuthWrapper from '@/components/admin/AdminAuthWrapper';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthWrapper>
      <AdminShell>{children}</AdminShell>
    </AdminAuthWrapper>
  );
}
