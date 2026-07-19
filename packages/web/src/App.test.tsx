import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { getComparison } from './api/client';
import { App } from './App';

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return { ...actual, getComparison: vi.fn(() => new Promise(() => {})) };
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
