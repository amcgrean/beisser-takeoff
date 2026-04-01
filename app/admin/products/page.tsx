import { Metadata } from 'next';
import ProductsClient from './ProductsClient';

export const metadata: Metadata = { title: 'Products | Admin | LiveEdge' };

export default function ProductsPage() {
  return <ProductsClient />;
}
