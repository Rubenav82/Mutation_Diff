import { Link, Route, Routes } from 'react-router-dom';
import { ComparisonDashboardPage } from './pages/ComparisonDashboardPage';
import { NewComparisonPage } from './pages/NewComparisonPage';

/**
 * The brand mark is a `<span>`, not a heading: each page owns the document's
 * single `<h1>`, and a permanent header heading would compete with it.
 */
function AppHeader() {
  return (
    <header className="border-b border-line bg-raised/70 backdrop-blur-sm">
      <div className="h-0.5 bg-accent" />
      <div className="mx-auto flex max-w-6xl items-baseline gap-3 px-6 py-4">
        <Link to="/" className="font-mono text-base font-semibold tracking-tight text-ink">
          Muta<span className="text-accent">Diff</span>
        </Link>
        <span className="hidden text-sm text-muted sm:inline">
          Comparador de ejecuciones de mutation testing
        </span>
      </div>
    </header>
  );
}

export function App() {
  return (
    <>
      <AppHeader />
      <div className="mx-auto w-full max-w-6xl px-6 pt-8 pb-24">
        <Routes>
          <Route path="/" element={<NewComparisonPage />} />
          <Route path="/comparisons/:id" element={<ComparisonDashboardPage />} />
        </Routes>
      </div>
    </>
  );
}
