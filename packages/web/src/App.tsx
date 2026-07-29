import { Link, Route, Routes } from 'react-router-dom';
import { LogoAqa } from './components/LogoAqa';
import { ComparisonDashboardPage } from './pages/ComparisonDashboardPage';
import { NewComparisonPage } from './pages/NewComparisonPage';

/**
 * The brand mark is a `<span>`, not a heading: each page owns the document's
 * single `<h1>`, and a permanent header heading would compete with it.
 */
function AppHeader() {
  // Plano y opaco: Modernist no usa translucidez ni desenfoque.
  return (
    <header className="border-b border-line bg-raised">
      <div className="h-0.5 bg-accent" />
      {/* `items-center`, no `items-baseline`: con el logotipo al lado, alinear
          por la línea base de un SVG lo descuadra respecto al texto. */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <LogoAqa className="h-9 w-auto shrink-0" />
          <span className="border-l border-line pl-3 font-mono text-base font-semibold tracking-tight text-ink">
            Mutator <span className="text-accent">Assessment</span> Report
          </span>
        </Link>
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
