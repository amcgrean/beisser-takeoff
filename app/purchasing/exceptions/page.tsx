import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { TopNav } from '../../../src/components/nav/TopNav';
import ExceptionsClient from './ExceptionsClient';

export const metadata = { title: 'Purchasing Exceptions' };

export default async function ExceptionsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const isAdmin =
    session.user.role === 'admin' ||
    (session.user.roles ?? []).some((r: string) => ['admin', 'supervisor', 'purchasing'].includes(r));

  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav userName={session.user.name} userRole={session.user.role} />
      <ExceptionsClient isAdmin={isAdmin} userBranch={session.user.branch ?? null} />
    </div>
  );
}
