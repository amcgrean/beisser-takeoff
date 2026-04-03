import { Metadata } from 'next';
import AppUsersClient from './AppUsersClient';

export const metadata: Metadata = { title: 'App Users | Admin | LiveEdge' };

export default function AppUsersPage() {
  return <AppUsersClient />;
}
