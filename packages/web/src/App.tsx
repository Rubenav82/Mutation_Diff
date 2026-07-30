import { Link, Route, Routes } from 'react-router-dom';
import { AboutMenu } from './components/AboutMenu';
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
        <div className="ml-auto">
          <AboutMenu />
        </div>
      </div>
    </header>
  );
}

/**
 * Legal disclaimer about the AQA mark. It lives outside the routed content, next
 * to nothing else: what it qualifies is the logo in the header, which is on every
 * page, so the notice has to be on every page too.
 */
function AppFooter() {
  return (
    <footer className="border-t border-line px-6 py-10">
      <p className="mx-auto max-w-4xl text-center text-xs leading-relaxed text-muted">
        Aclaración: El logotipo de AQA (Agile Quality Assurance) presentado en este material es una
        imagen de referencia conceptual diseñada exclusivamente para el programa de formación
        interno como parte de la estrategia de calidad. El uso e inclusión de este diseño es de
        carácter ilustrativo y no constituye ni implica ninguna obligación contractual, afiliación,
        endoso o asociación con ninguna empresa, entidad legal o marca registrada externa.
      </p>
    </footer>
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
      <AppFooter />
    </>
  );
}
