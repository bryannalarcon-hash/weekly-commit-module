// libs/ui/src/Metric.test.tsx — proves the metric tile renders the label + value (+ suffix) and a delta
// chip whose arrow tracks the sign (▲ positive / ▼ negative / none when zero or omitted).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Metric } from './Metric';

describe('Metric', () => {
  it('renders the label and value with a suffix', () => {
    render(<Metric label="Weekly completion" value="78" suffix="%" />);
    expect(screen.getByTestId('metric')).toHaveTextContent('Weekly completion');
    expect(screen.getByTestId('metric-value')).toHaveTextContent('78%');
  });

  it('shows an up arrow for a positive delta', () => {
    render(<Metric label="x" value="78" delta={6} />);
    expect(screen.getByTestId('metric-delta')).toHaveTextContent('▲');
    expect(screen.getByTestId('metric-delta')).toHaveTextContent('6pts');
  });

  it('shows a down arrow for a negative delta', () => {
    render(<Metric label="x" value="14" delta={-3} />);
    expect(screen.getByTestId('metric-delta')).toHaveTextContent('▼');
    expect(screen.getByTestId('metric-delta')).toHaveTextContent('3pts');
  });

  it('omits the delta chip when delta is not provided', () => {
    render(<Metric label="x" value="3" />);
    expect(screen.queryByTestId('metric-delta')).not.toBeInTheDocument();
  });
});
