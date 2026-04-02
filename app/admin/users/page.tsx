import { Metadata } from 'next';
import UsersClient from './UsersClient';

export const metadata: Metadata = { title: 'Users | Admin | LiveEdge' };

export default function UsersPage() {
  return <UsersClient />;
}
