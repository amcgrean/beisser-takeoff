import { auth } from '../auth';
import { redirect } from 'next/navigation';
import { TopNav } from '../src/components/nav/TopNav';
import HomeClient from './HomeClient';

export const metadata = { title: 'LiveEdge' };

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav
        userName={session.user?.name}
        userRole={session.user?.role}
      />
      <HomeClient
        userName={session.user?.name ?? null}
        userRole={session.user?.role ?? null}
        userBranch={session.user?.branch ?? null}
      />
    </div>
  );
}
