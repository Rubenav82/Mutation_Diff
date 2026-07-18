import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, createComparison } from '../api/client';
import { ComparisonDashboardPage } from './ComparisonDashboardPage';
import { NewComparisonPage } from './NewComparisonPage';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return { ...actual, createComparison: vi.fn() };
});

const createComparisonMock = vi.mocked(createComparison);

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<NewComparisonPage />} />
        <Route path="/comparisons/:id" element={<ComparisonDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function xmlFile(name: string): File {
  return new File(['<mutations/>'], name, { type: 'text/xml' });
}

async function selectFiles(
  user: ReturnType<typeof userEvent.setup>,
  baseName: string,
  headName: string,
) {
  const baseInput = screen.getByLabelText(/ejecución base/i, { selector: 'input' });
  const headInput = screen.getByLabelText(/ejecución nueva/i, { selector: 'input' });
  await user.upload(baseInput, xmlFile(baseName));
  await user.upload(headInput, xmlFile(headName));
}

beforeEach(() => {
  createComparisonMock.mockReset();
});

describe('NewComparisonPage', () => {
  it('defaults to PiTest with .xml hints in both drop zones', () => {
    renderWizard();

    expect(screen.getByRole('radio', { name: /pitest/i })).toBeChecked();
    expect(screen.getAllByText(/\.xml/)).toHaveLength(2);
  });

  it('switches the extension hint to .json and clears selected files when Stryker is chosen', async () => {
    const user = userEvent.setup();
    renderWizard();
    await selectFiles(user, 'base.xml', 'head.xml');

    await user.click(screen.getByRole('radio', { name: /stryker/i }));

    expect(screen.getAllByText(/\.json/)).toHaveLength(2);
    expect(screen.queryByText('base.xml')).not.toBeInTheDocument();
  });

  it('keeps the submit button disabled until both files are selected', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(screen.getByRole('button', { name: /comparar/i })).toBeDisabled();

    const baseInput = screen.getByLabelText(/ejecución base/i, { selector: 'input' });
    await user.upload(baseInput, xmlFile('base.xml'));
    expect(screen.getByRole('button', { name: /comparar/i })).toBeDisabled();

    const headInput = screen.getByLabelText(/ejecución nueva/i, { selector: 'input' });
    await user.upload(headInput, xmlFile('head.xml'));
    expect(screen.getByRole('button', { name: /comparar/i })).toBeEnabled();
  });

  it('submits the form and navigates to the comparison dashboard on success', async () => {
    const user = userEvent.setup();
    createComparisonMock.mockResolvedValue({
      comparisonId: 'abc-123',
      result: { tool: 'pitest' } as never,
    });
    renderWizard();
    await selectFiles(user, 'base.xml', 'head.xml');

    await user.click(screen.getByRole('button', { name: /comparar/i }));

    expect(createComparisonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'pitest',
        baseFile: expect.any(File),
        headFile: expect.any(File),
      }),
    );
    expect(await screen.findByText('Dashboard — abc-123')).toBeInTheDocument();
  });

  it('includes optional thresholds in the request when provided', async () => {
    const user = userEvent.setup();
    createComparisonMock.mockResolvedValue({ comparisonId: 'id', result: {} as never });
    renderWizard();
    await selectFiles(user, 'base.xml', 'head.xml');

    await user.type(screen.getByLabelText(/umbral de regresión/i), '5');
    await user.type(screen.getByLabelText(/umbral sin cobertura/i), '90');
    await user.click(screen.getByRole('button', { name: /comparar/i }));

    expect(createComparisonMock).toHaveBeenCalledWith(
      expect.objectContaining({ regressionThreshold: 5, uncoveredThreshold: 90 }),
    );
  });

  it('shows the API error message and stays on the wizard when the request fails', async () => {
    const user = userEvent.setup();
    createComparisonMock.mockRejectedValue(
      new ApiClientError(422, 'INVALID_REPORT', 'Invalid PiTest report'),
    );
    renderWizard();
    await selectFiles(user, 'base.xml', 'head.xml');

    await user.click(screen.getByRole('button', { name: /comparar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid PiTest report');
    expect(screen.getByRole('heading', { name: /nueva comparación/i })).toBeInTheDocument();
  });

  it('toggles the configuration help panel with the ⓘ button', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(
      screen.queryByRole('region', { name: /ayuda de configuración/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ayuda de configuración/i }));

    expect(screen.getByRole('region', { name: /ayuda de configuración/i })).toBeInTheDocument();
    expect(screen.getByText(/target\/pit-reports/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ayuda de configuración/i }));

    expect(
      screen.queryByRole('region', { name: /ayuda de configuración/i }),
    ).not.toBeInTheDocument();
  });

  it('shows Stryker help content when Stryker is selected while the panel is open', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByRole('button', { name: /ayuda de configuración/i }));

    await user.click(screen.getByRole('radio', { name: /stryker/i }));

    expect(screen.getByText(/reports\/mutation\/mutation\.json/)).toBeInTheDocument();
    expect(screen.queryByText(/target\/pit-reports/)).not.toBeInTheDocument();
  });

  it('opens the help panel from the "ver instrucciones" link in a file validation error', () => {
    renderWizard();
    const baseInput = screen.getByLabelText(/ejecución base/i, { selector: 'input' });
    fireEvent.change(baseInput, {
      target: { files: [new File(['{}'], 'base.json', { type: 'application/json' })] },
    });

    fireEvent.click(screen.getByRole('button', { name: /ver instrucciones/i }));

    expect(screen.getByRole('region', { name: /ayuda de configuración/i })).toBeInTheDocument();
  });
});
