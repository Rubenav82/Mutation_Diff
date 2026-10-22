import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ComparisonError,
  createComparison,
  getComparison,
  importComparison,
} from '../lib/comparisons';
import { ComparisonDashboardPage } from './ComparisonDashboardPage';
import { NewComparisonPage } from './NewComparisonPage';

vi.mock('../lib/comparisons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/comparisons')>();
  return {
    ...actual,
    createComparison: vi.fn(),
    getComparison: vi.fn(),
    importComparison: vi.fn(),
  };
});

const createComparisonMock = vi.mocked(createComparison);
const getComparisonMock = vi.mocked(getComparison);
const importComparisonMock = vi.mocked(importComparison);

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

const PREFERENCES_KEY = 'mutadiff:preferences';

function storedPreferences(): unknown {
  return JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null');
}

beforeEach(() => {
  // Las preferencias viven en el localStorage real de jsdom, que persiste entre
  // tests del mismo fichero: sin esto, el primero que guarde cambia el estado
  // inicial de todos los siguientes.
  localStorage.clear();
  createComparisonMock.mockReset();
  getComparisonMock.mockReset();
  importComparisonMock.mockReset();
  // The dashboard fetches on mount after navigation; keep it pending so tests
  // that only assert the wizard's navigation don't hit an unmocked fetch.
  getComparisonMock.mockReturnValue(new Promise(() => {}));
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

    // «fichero .json» y no «.json» a secas: la zona de importar pide un
    // «.mutadiff.json», que no depende de la herramienta.
    expect(screen.getAllByText(/fichero \.json/)).toHaveLength(2);
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
    expect(await screen.findByText(/cargando comparación/i)).toBeInTheDocument();
    await waitFor(() => expect(getComparisonMock).toHaveBeenCalledWith('abc-123'));
  });

  it('includes optional thresholds in the request when provided', async () => {
    const user = userEvent.setup();
    createComparisonMock.mockResolvedValue({ comparisonId: 'id', result: {} as never });
    renderWizard();
    await selectFiles(user, 'base.xml', 'head.xml');

    await user.type(screen.getByLabelText(/umbral de retroceso/i), '5');
    await user.type(screen.getByLabelText(/umbral sin cobertura/i), '90');
    await user.click(screen.getByRole('button', { name: /comparar/i }));

    expect(createComparisonMock).toHaveBeenCalledWith(
      expect.objectContaining({ regressionThreshold: 5, uncoveredThreshold: 90 }),
    );
  });

  it('announces progress and marks the submit button busy while comparing', async () => {
    const user = userEvent.setup();
    createComparisonMock.mockReturnValue(new Promise(() => {}));
    renderWizard();
    await selectFiles(user, 'base.xml', 'head.xml');

    await user.click(screen.getByRole('button', { name: /comparar/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/comparando/i);
    const submit = screen.getByRole('button', { name: /comparar/i });
    expect(submit).toHaveAttribute('aria-busy', 'true');
    expect(submit).toBeDisabled();
  });

  it('shows the API error message and stays on the wizard when the request fails', async () => {
    const user = userEvent.setup();
    createComparisonMock.mockRejectedValue(
      new ComparisonError(422, 'INVALID_REPORT', 'Invalid PiTest report'),
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

  it('toggles the threshold help panel independently of the tool help', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(screen.queryByRole('region', { name: /ayuda de umbrales/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ayuda de umbrales/i }));

    expect(screen.getByRole('region', { name: /ayuda de umbrales/i })).toBeInTheDocument();
    // Son dos paneles distintos: abrir uno no abre el otro.
    expect(
      screen.queryByRole('region', { name: /ayuda de configuración/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ayuda de umbrales/i }));

    expect(screen.queryByRole('region', { name: /ayuda de umbrales/i })).not.toBeInTheDocument();
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

  describe('importing an exported comparison', () => {
    function importInput(): HTMLInputElement {
      return screen.getByLabelText(/importar comparación/i, { selector: 'input' });
    }

    function comparisonFile(): File {
      return new File(['{}'], 'resultado.mutadiff.json', { type: 'application/json' });
    }

    it('offers a separate zone that only takes exported comparisons', () => {
      renderWizard();

      expect(importInput()).toHaveAttribute('accept', '.mutadiff.json');
    });

    it('does not depend on the tool, since the file already says which one it was', async () => {
      const user = userEvent.setup();
      renderWizard();

      await user.click(screen.getByRole('radio', { name: /stryker/i }));

      expect(importInput()).toHaveAttribute('accept', '.mutadiff.json');
    });

    it('opens the comparison as soon as the file is chosen, with no extra button', async () => {
      const user = userEvent.setup();
      importComparisonMock.mockResolvedValue({ comparisonId: 'imported-1', result: {} as never });
      renderWizard();
      const file = comparisonFile();

      await user.upload(importInput(), file);

      expect(importComparisonMock).toHaveBeenCalledWith(file);
      await waitFor(() => expect(getComparisonMock).toHaveBeenCalledWith('imported-1'));
    });

    it('announces progress while the file is read', async () => {
      const user = userEvent.setup();
      importComparisonMock.mockReturnValue(new Promise(() => {}));
      renderWizard();

      await user.upload(importInput(), comparisonFile());

      expect(await screen.findByRole('status')).toHaveTextContent('Importando…');
    });

    it('shows why the file was rejected and stays on the wizard', async () => {
      const user = userEvent.setup();
      importComparisonMock.mockRejectedValue(
        new ComparisonError(
          422,
          'INVALID_COMPARISON_FILE',
          'La comparación exportada está incompleta o dañada (units).',
        ),
      );
      renderWizard();

      await user.upload(importInput(), comparisonFile());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'La comparación exportada está incompleta o dañada (units).',
      );
      expect(screen.getByRole('heading', { name: /nueva comparación/i })).toBeInTheDocument();
      // Se retira el fichero rechazado, para que el siguiente intento empiece limpio.
      expect(screen.queryByText('resultado.mutadiff.json')).not.toBeInTheDocument();
    });

    it('falls back to a generic message for an unexpected failure', async () => {
      const user = userEvent.setup();
      importComparisonMock.mockRejectedValue(new Error('boom'));
      renderWizard();

      await user.upload(importInput(), comparisonFile());

      expect(await screen.findByRole('alert')).toHaveTextContent('Error inesperado al importar');
    });

    it('keeps an import error apart from a comparison error', async () => {
      // Dos acciones distintas: un error al importar no debe quedarse pegado al
      // botón «Comparar», ni al revés.
      const user = userEvent.setup();
      importComparisonMock.mockRejectedValue(
        new ComparisonError(422, 'INVALID_COMPARISON_FILE', 'fichero dañado'),
      );
      renderWizard();
      await user.upload(importInput(), comparisonFile());
      await screen.findByRole('alert');

      createComparisonMock.mockRejectedValue(
        new ComparisonError(422, 'INVALID_REPORT', 'Invalid PiTest report'),
      );
      await selectFiles(user, 'base.xml', 'head.xml');
      await user.click(screen.getByRole('button', { name: /comparar/i }));

      await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
      // Cada uno en su sitio: el de comparar con el formulario, el de importar
      // con su zona, que va después.
      const [compareAlert, importAlert] = screen.getAllByRole('alert');
      expect(compareAlert).toHaveTextContent('Invalid PiTest report');
      expect(importAlert).toHaveTextContent('fichero dañado');
    });
  });
});

describe('NewComparisonPage — preferencias recordadas', () => {
  const saved = { tool: 'stryker', regressionThreshold: '5', uncoveredThreshold: '75' };

  function savePreferences(value: unknown) {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
  }

  function importComparisonFile(user: ReturnType<typeof userEvent.setup>) {
    const input = screen.getByLabelText(/importar comparación/i, { selector: 'input' });
    return user.upload(input, new File(['{}'], 'resultado.mutadiff.json'));
  }

  it('starts with the tool and thresholds of the last comparison', () => {
    savePreferences(saved);
    renderWizard();

    expect(screen.getByRole('radio', { name: /stryker/i })).toBeChecked();
    expect(screen.getByLabelText(/umbral de retroceso/i)).toHaveValue(5);
    expect(screen.getByLabelText(/umbral sin cobertura/i)).toHaveValue(75);
    // Y las zonas piden ya la extension de esa herramienta, sin tocar nada.
    expect(screen.getAllByText(/fichero \.json/)).toHaveLength(2);
  });

  it('remembers the tool and thresholds of a comparison that worked', async () => {
    const user = userEvent.setup();
    createComparisonMock.mockResolvedValue({ comparisonId: 'id', result: {} as never });
    renderWizard();
    await user.click(screen.getByRole('radio', { name: /stryker/i }));
    await selectFiles(user, 'base.json', 'head.json');
    await user.type(screen.getByLabelText(/umbral de retroceso/i), '5');

    await user.click(screen.getByRole('button', { name: /comparar/i }));

    await waitFor(() =>
      expect(storedPreferences()).toEqual({
        tool: 'stryker',
        regressionThreshold: '5',
        // Vacio tal cual: no se convierte a «100» ni se inventa un valor que el
        // usuario no escribio.
        uncoveredThreshold: '',
      }),
    );
  });

  it('remembers nothing when the comparison failed', async () => {
    // Lo que se recuerda son los valores de una comparacion que salio bien: si
    // el reporte no era valido, no hay nada que repetir la proxima vez.
    const user = userEvent.setup();
    createComparisonMock.mockRejectedValue(
      new ComparisonError(422, 'INVALID_REPORT', 'Invalid PiTest report'),
    );
    renderWizard();
    await selectFiles(user, 'base.xml', 'head.xml');

    await user.click(screen.getByRole('button', { name: /comparar/i }));

    await screen.findByRole('alert');
    expect(storedPreferences()).toBeNull();
  });

  it('leaves the preferences alone when a comparison is imported', async () => {
    // El fichero trae su propia herramienta y sus umbrales dentro: importar no
    // dice nada sobre lo que el usuario quiere la proxima vez que compare.
    const user = userEvent.setup();
    savePreferences(saved);
    importComparisonMock.mockResolvedValue({ comparisonId: 'imported', result: {} as never });
    renderWizard();

    await importComparisonFile(user);

    await waitFor(() => expect(getComparisonMock).toHaveBeenCalledWith('imported'));
    expect(storedPreferences()).toEqual(saved);
  });
});
