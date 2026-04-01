import { auth } from '../../auth';
import { redirect } from 'next/navigation';
import ITIssuesClient from './ITIssuesClient';

export const metadata = { title: 'IT Issues | LiveEdge' };

export default async function ITIssuesPage() {
  const session = await auth();
  if (!session) redirect('/login');
  return <ITIssuesClient session={session} />;
}
