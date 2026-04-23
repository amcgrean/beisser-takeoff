import { auth } from '../../../../../../auth';
import { redirect } from 'next/navigation';
import { TopNav } from '../../../../../../src/components/nav/TopNav';
import JobDetailClient from './JobDetailClient';

type Props = { params: Promise<{ code: string; seq: string }> };

export async function generateMetadata({ params }: Props) {
  const { code, seq } = await params;
  return { title: `Job ${code} #${seq}` };
}

export default async function CustomerJobDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { code, seq } = await params;

  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav userName={session.user.name} userRole={session.user.role} />
      <JobDetailClient code={code.toUpperCase()} seq={seq} />
    </div>
  );
}
