import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { getComparison } from './lib/comparisons';
import { App } from './App';

vi.mock('./lib/comparisons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/comparisons')>();
  return { ...actual, getComparison: vi.fn(() => new Promise(() => {})) };
});

describe('AppHeader', () => {
  it('shows the brand mark next to the product name, both linking home', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    // Con nombre accesible propio, no `aria-hidden`: identifica a la
    // organización, que es un dato que el texto de al lado no da.
    const logo = screen.getByRole('img', { name: /agile quality assurance/i });
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('offers the about panel from every page', () => {
    render(
      <MemoryRouter initialEntries={['/comparisons/abc-123']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /acerca de/i })).toBeInTheDocument();
  });
});

describe('AppFooter', () => {
  it('qualifies the AQA mark with the legal disclaimer', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(/imagen de referencia conceptual/i);
    expect(footer).toHaveTextContent(/programa de formación interno/i);
    expect(footer).toHaveTextContent(
      /no constituye ni implica ninguna obligación contractual, afiliación, endoso o asociación/i,
    );
  });
});

describe('App routing', () => {
  it('renders the new comparison page at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /nueva comparación/i })).toBeInTheDocument();
  });

  it('renders the comparison dashboard page at /comparisons/:id', () => {
    render(
      <MemoryRouter initialEntries={['/comparisons/abc-123']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText(/cargando comparación/i)).toBeInTheDocument();
    expect(vi.mocked(getComparison)).toHaveBeenCalledWith('abc-123');
  });
});
