import { useParams } from 'react-router-dom';

export function ComparisonDashboardPage() {
  const { id } = useParams<{ id: string }>();
  return <h1>Dashboard — {id}</h1>;
}
