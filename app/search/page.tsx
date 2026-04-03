import { auth } from '../../auth';
import { redirect } from 'next/navigation';
import SearchClient from './SearchClient';

export const metadata = { title: 'Search — LiveEdge' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const params = await searchParams;

  return (
    <SearchClient
      userName={(session.user as { name?: string }).name ?? null}
      userRole={(session.user as { role?: string }).role}
      initialQuery={params.q ?? ''}
    />
  );
}
