import { redirect } from 'next/navigation';
import TVBoardClient from './TVBoardClient';

const VALID_BRANCHES = ['10FD', '20GR', '25BW', '40CV'];

export default async function TVBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ branch: string }>;
  searchParams: Promise<{ hc?: string }>;
}) {
  const { branch } = await params;
  const { hc } = await searchParams;
  const b = branch.toUpperCase();
  if (!VALID_BRANCHES.includes(b)) redirect('/');

  return <TVBoardClient branch={b} handlingCode={hc?.toUpperCase() ?? null} />;
}
