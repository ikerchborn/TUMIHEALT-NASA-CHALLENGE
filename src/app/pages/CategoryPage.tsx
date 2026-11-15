import { Navigate } from 'react-router-dom';
import type { HealthCategory } from '@/types';

const CATEGORY_ROUTES: Record<HealthCategory, string> = {
  blood: '/blood',
  sleep: '/sleep',
  cardiovascular: '/cardiovascular',
};

export function CategoryPage({
  category,
}: {
  category: HealthCategory;
  title: string;
}) {
  return <Navigate to={CATEGORY_ROUTES[category]} replace />;
}
