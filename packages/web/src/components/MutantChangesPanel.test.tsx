import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MutantComparison } from 'core';
import { MutantChangesPanel } from './MutantChangesPanel';

const CHANGES: MutantComparison[] = [
  {
    line: 8,
    mutator: 'org.pitest.mutationtest.engine.gregor.mutators.NegateConditionalsMutator',
    description: 'negated conditional',
    base: 'killed',
    head: 'survived',
    kind: 'newly-survived',
  },
  {
    line: 15,
    mutator: 'org.pitest.mutationtest.engine.gregor.mutators.MathMutator',
    base: 'survived',
    head: 'killed',
    kind: 'newly-killed',
  },
  {
    line: 22,
    mutator: 'ArithmeticOperator',
    head: 'no_coverage',
    kind: 'added',
  },
  {
    line: 30,
    mutator: 'org.pitest.mutationtest.engine.gregor.mutators.ReturnValsMutator',
    base: 'timeout',
    kind: 'removed',
  },
];

function bodyRows(): HTMLElement[] {
  const [, body] = screen.getAllByRole('rowgroup');
  return within(body as HTMLElement).getAllByRole('row');
}

describe('MutantChangesPanel', () => {
  it('renders one row per change, in the order received, with line and statuses', () => {
    render(<MutantChangesPanel unitKey="com.example.StringUtils" changes={CHANGES} />);

    const rows = bodyRows();
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.getAttribute('data-change-kind'))).toEqual([
      'newly-survived',
      'newly-killed',
      'added',
      'removed',
    ]);

    const first = rows[0] as HTMLElement;
    expect(within(first).getByText('8')).toBeInTheDocument();
    expect(within(first).getByText('Killed')).toBeInTheDocument();
    expect(within(first).getByText('Survived')).toBeInTheDocument();
    expect(within(first).getByText('Nuevo superviviente')).toBeInTheDocument();
  });

  it('labels every change kind in Spanish', () => {
    render(<MutantChangesPanel unitKey="com.example.StringUtils" changes={CHANGES} />);

    expect(screen.getByText('Ahora detectado')).toBeInTheDocument();
    expect(screen.getByText('Nuevo')).toBeInTheDocument();
    expect(screen.getByText('Eliminado')).toBeInTheDocument();
  });

  it('shows the short mutator name and keeps the full one as title', () => {
    render(<MutantChangesPanel unitKey="com.example.StringUtils" changes={CHANGES} />);

    const mutator = screen.getByText('NegateConditionalsMutator');
    expect(mutator).toHaveAttribute(
      'title',
      'org.pitest.mutationtest.engine.gregor.mutators.NegateConditionalsMutator',
    );
    // Un nombre sin paquete (Stryker) se muestra tal cual.
    expect(screen.getByText('ArithmeticOperator')).toBeInTheDocument();
  });

  it('shows the description when the mutant has one', () => {
    render(<MutantChangesPanel unitKey="com.example.StringUtils" changes={CHANGES} />);

    expect(screen.getByText('negated conditional')).toBeInTheDocument();
  });

  it('shows an em dash for the side a mutant is missing from', () => {
    render(<MutantChangesPanel unitKey="com.example.StringUtils" changes={CHANGES} />);

    const added = bodyRows()[2] as HTMLElement;
    expect(within(added).getByText('—')).toBeInTheDocument();
    expect(within(added).getByText('Sin cubrir')).toBeInTheDocument();
  });

  it('filters down to the new survivors and back', async () => {
    const user = userEvent.setup();
    render(<MutantChangesPanel unitKey="com.example.StringUtils" changes={CHANGES} />);

    const toggle = screen.getByRole('checkbox', {
      name: 'Solo nuevos supervivientes · com.example.StringUtils',
    });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Nuevo superviviente')).toBeInTheDocument();

    await user.click(toggle);
    expect(bodyRows()).toHaveLength(4);
  });

  it('says so when the filter leaves nothing', async () => {
    const user = userEvent.setup();
    render(
      <MutantChangesPanel
        unitKey="com.example.Calculator"
        changes={CHANGES.filter((change) => change.kind !== 'newly-survived')}
      />,
    );

    await user.click(screen.getByRole('checkbox'));
    expect(screen.queryAllByRole('rowgroup')).toHaveLength(0);
    expect(screen.getByText('Ningún mutante nuevo sobrevive.')).toBeInTheDocument();
  });
});
