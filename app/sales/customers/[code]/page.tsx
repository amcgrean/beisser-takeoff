import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import CustomerClient from './CustomerClient';

export default async function CustomerPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { code } = await params;

  const isAdmin =
    session.user.role === 'admin' ||
    (session.user.roles ?? []).some((r) => ['admin', 'supervisor', 'ops', 'sales'].includes(r));

  return <CustomerClient code={code} isAdmin={isAdmin} />;
}
