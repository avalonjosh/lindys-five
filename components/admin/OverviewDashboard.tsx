'use client';

// Overview home — glanceable "what happened since I last looked" dashboard.
// Phase A ships the shell; the data cards land with the Overview phase.

import { PageHeader, Card, Button } from './ui';

export default function OverviewDashboard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Overview"
        description="Your site at a glance — traffic, drafts, subscribers, and automation."
      />
      <Card>
        <p className="text-sm text-gray-500">
          The Overview dashboard is being assembled. Jump straight to a section:
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button href="/admin/posts" variant="primary">Posts</Button>
          <Button href="/admin/subscribers">Subscribers</Button>
          <Button href="/admin/analytics">Analytics</Button>
          <Button href="/admin/outreach">Outreach</Button>
        </div>
      </Card>
    </div>
  );
}
