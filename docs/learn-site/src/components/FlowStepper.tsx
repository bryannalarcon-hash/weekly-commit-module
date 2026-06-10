// FlowStepper.tsx — "Follow a request" walkthrough over the `flow` steps.
// Prev/Next + step dots; each step shows Plain/Deep narration and highlights its layerId on
// the shared map (via onActiveLayer); reports the active layer name for the linked view.
import { useState } from 'react';
import type { FlowStep, Register } from '../types';
import { renderMarkdown } from '../lib/markdown';
import { RegisterToggle } from './RegisterToggle';

interface Props {
  steps: FlowStep[];
  defaultRegister: Register;
  layerNameById: Map<string, string>;
  /** Called whenever the active step changes so the map can highlight step.layerId. */
  onActiveLayer: (layerId: string | null) => void;
}

export function FlowStepper({ steps, defaultRegister, layerNameById, onActiveLayer }: Props) {
  const [index, setIndex] = useState(0);
  const [register, setRegister] = useState<Register>(defaultRegister);

  if (steps.length === 0) {
    return <p className="empty-note">No request flow is defined yet.</p>;
  }

  const step = steps[index];

  const goto = (next: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, next));
    setIndex(clamped);
    onActiveLayer(steps[clamped].layerId);
  };

  return (
    <div className="flow-stepper">
      <div className="flow-stepper__bar">
        <div className="flow-dots" role="tablist" aria-label="Request steps">
          {steps.map((s, i) => (
            <button
              key={s.step}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Step ${s.step}: ${s.title}`}
              className={`flow-dot${i === index ? ' is-active' : ''}`}
              onClick={() => goto(i)}
            />
          ))}
        </div>
        <RegisterToggle
          value={register}
          onChange={setRegister}
          label="Reading depth for the request flow"
          size="sm"
        />
      </div>

      <div className="flow-card" role="tabpanel" aria-label={step.title}>
        <p className="flow-meta">
          Step {step.step} of {steps.length} · highlights{' '}
          <strong>{layerNameById.get(step.layerId) ?? step.layerId}</strong>
        </p>
        <h3 className="flow-title">{step.title}</h3>
        <div className="prose">
          {register === 'plain' ? (
            <p className="md-p">{step.plain}</p>
          ) : (
            renderMarkdown(step.deep)
          )}
        </div>
      </div>

      <div className="flow-nav">
        <button
          type="button"
          className="btn"
          onClick={() => goto(index - 1)}
          disabled={index === 0}
        >
          ← Prev
        </button>
        <span className="flow-progress" aria-hidden="true">
          {index + 1} / {steps.length}
        </span>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => goto(index + 1)}
          disabled={index === steps.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
