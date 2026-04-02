import { auth } from '../../auth';
import SupervisorClient from './SupervisorClient';

export default async function SupervisorPage() {
  const session = await auth();
  const isAdmin =
    session!.user.role === 'admin' ||
    (session!.user.roles ?? []).some((r) => ['admin', 'supervisor', 'ops'].includes(r));

  return (
    <SupervisorClient
      isAdmin={isAdmin}
      userName={session!.user.name ?? null}
    />
  );
}
