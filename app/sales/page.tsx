import { auth } from '../../auth';
import SalesClient from './SalesClient';

export default async function SalesPage() {
  const session = await auth();
  const isAdmin =
    session!.user.role === 'admin' ||
    (session!.user.roles ?? []).some((r) => ['admin', 'supervisor', 'ops'].includes(r));

  return (
    <SalesClient
      isAdmin={isAdmin}
      userBranch={session!.user.branch ?? null}
      userName={session!.user.name ?? null}
    />
  );
}
