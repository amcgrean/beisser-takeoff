import { redirect } from 'next/navigation';
import KioskPickersClient from './KioskPickersClient';

const VALID_BRANCHES = ['10FD', '20GR', '25BW', '40CV'];

export default async function KioskPage({ params }: { params: Promise<{ branch: string }> }) {
  const { branch } = await params;
  const b = branch.toUpperCase();
  if (!VALID_BRANCHES.includes(b)) redirect('/');

  return <KioskPickersClient branch={b} />;
}
