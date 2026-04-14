import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import AnalyticsClient from './AnalyticsClient';

export const metadata = { title: 'Page Analytics | LiveEdge Admin' };

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/');
  return <AnalyticsClient />;
}
