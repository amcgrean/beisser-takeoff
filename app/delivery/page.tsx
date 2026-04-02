import { auth } from '../../auth';
import DeliveryClient from './DeliveryClient';

export default async function DeliveryPage() {
  const session = await auth();
  const isAdmin =
    session!.user.role === 'admin' ||
    (session!.user.roles ?? []).some((r) => ['admin', 'supervisor', 'ops', 'dispatch'].includes(r));

  return (
    <DeliveryClient
      isAdmin={isAdmin}
      userBranch={session!.user.branch ?? null}
      userName={session!.user.name ?? null}
    />
  );
}
