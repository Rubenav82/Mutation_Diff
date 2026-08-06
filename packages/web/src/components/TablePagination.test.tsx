import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ALL_ROWS, TablePagination } from './TablePagination';

type Props = Parameters<typeof TablePagination>[0];

function renderPagination(over: Partial<Props> = {}) {
  const props: Props = {
    label: 'Retrocesos',
    pageIndex: 0,
    pageSize: 5,
    pageCount: 3,
    totalRows: 12,
    onPageSizeChange: () => {},
    onPreviousPage: () => {},
    onNextPage: () => {},
    ...over,
  };
  return render(<TablePagination {...props} />);
}

describe('TablePagination', () => {
  // Cinco controles idénticos en la misma pantalla (cuatro secciones más la tabla
  // completa) no se distinguen entre sí al navegar por teclado o con lector.
  it('names its controls after the table they belong to', () => {
    renderPagination();

    expect(
      screen.getByRole('combobox', { name: 'Filas por página · Retrocesos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Página siguiente · Retrocesos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Página anterior · Retrocesos' }),
    ).toBeInTheDocument();
  });

  it('reports which page is on screen and how many there are', () => {
    renderPagination();

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('has nowhere to go back from the first page, nor forward from the last', () => {
    const { unmount } = renderPagination();
    expect(screen.getByRole('button', { name: /página anterior/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /página siguiente/i })).not.toBeDisabled();
    unmount();

    renderPagination({ pageIndex: 2 });
    expect(screen.getByRole('button', { name: /página siguiente/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /página anterior/i })).not.toBeDisabled();
  });

  it('moves through the pages on demand', async () => {
    const user = userEvent.setup();
    const onNextPage = vi.fn();
    const onPreviousPage = vi.fn();
    renderPagination({ pageIndex: 1, onNextPage, onPreviousPage });

    await user.click(screen.getByRole('button', { name: /página siguiente/i }));
    await user.click(screen.getByRole('button', { name: /página anterior/i }));

    expect(onNextPage).toHaveBeenCalledOnce();
    expect(onPreviousPage).toHaveBeenCalledOnce();
  });

  it('offers 5 as the smallest page size, because that is the one that saves scrolling', () => {
    renderPagination();

    const options = screen
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);
    expect(options).toEqual(['5', '25', '50', '100', 'all']);
  });

  // «Todas» es un tamaño de página centinela, no un modo aparte: así la tabla
  // sigue gobernando la paginación ella sola.
  it('reports «Todas» as a page size big enough to hold everything', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    renderPagination({ onPageSizeChange });

    await user.selectOptions(screen.getByRole('combobox', { name: /filas por página/i }), 'all');

    expect(onPageSizeChange).toHaveBeenCalledWith(ALL_ROWS);
  });

  it('shows «Todas» as the current size when everything is on one page', () => {
    renderPagination({ pageSize: ALL_ROWS, pageCount: 1 });

    expect(screen.getByRole('combobox', { name: /filas por página/i })).toHaveValue('all');
  });

  // Con una sola página no hay navegación que ofrecer, pero el selector se queda:
  // es la única forma de volver a «Todas» después.
  it('hides the navigation on a single page and keeps the size selector', () => {
    renderPagination({ pageCount: 1, pageSize: 25 });

    expect(screen.queryByRole('button', { name: /página siguiente/i })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filas por página/i })).toBeInTheDocument();
  });

  // Por debajo del tamaño de página más pequeño no hay nada que paginar ni motivo
  // para cambiarlo: todas las filas ya están a la vista. Cuatro secciones cortas
  // no deberían arrastrar cuatro selectores que no hacen nada.
  it('stays out of the way when every row already fits on the smallest page', () => {
    const { container } = renderPagination({ totalRows: 5, pageCount: 1 });

    expect(container).toBeEmptyDOMElement();
  });
});
