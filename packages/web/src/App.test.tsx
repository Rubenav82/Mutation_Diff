import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

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

    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
  });
});
