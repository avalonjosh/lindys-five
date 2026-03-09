import type { Metadata } from 'next';
import AdminAuthWrapper from '@/components/admin/AdminAuthWrapper';

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
      {children}
    </AdminAuthWrapper>
  );
}
