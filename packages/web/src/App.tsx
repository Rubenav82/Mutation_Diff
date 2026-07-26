import { Route, Routes } from 'react-router-dom';
import { ComparisonDashboardPage } from './pages/ComparisonDashboardPage';
import { NewComparisonPage } from './pages/NewComparisonPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<NewComparisonPage />} />
      <Route path="/comparisons/:id" element={<ComparisonDashboardPage />} />
    </Routes>
  );
}
