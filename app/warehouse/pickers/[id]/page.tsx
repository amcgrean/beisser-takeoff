import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import { TopNav } from '../../../../src/components/nav/TopNav';
import PickerDetailClient from './PickerDetailClient';

export default async function PickerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav userName={session.user.name} userRole={session.user.role} />
      <PickerDetailClient id={id} />
    </div>
  );
}
