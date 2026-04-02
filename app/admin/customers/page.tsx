import { Metadata } from 'next';
import CustomersClient from './CustomersClient';

export const metadata: Metadata = { title: 'Customers | Admin | LiveEdge' };

export default function CustomersPage() {
  return <CustomersClient />;
}
