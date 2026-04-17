import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { TopNav } from '../../../src/components/nav/TopNav';
import PickerStatsClient from './PickerStatsClient';

export default async function PickerStatsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const isAdmin =
    session.user.role === 'admin' ||
    (session.user.roles ?? []).some((r) => ['admin', 'supervisor', 'ops', 'warehouse'].includes(r));

  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav userName={session.user.name} userRole={session.user.role} />
      <PickerStatsClient isAdmin={isAdmin} />
    </div>
  );
}
