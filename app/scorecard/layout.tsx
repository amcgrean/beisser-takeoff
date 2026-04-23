import { redirect } from 'next/navigation';
import { auth } from '../../auth';

export const metadata = { title: 'Customer Scorecard — Beisser LiveEdge' };

export default async function ScorecardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return <>{children}</>;
}
