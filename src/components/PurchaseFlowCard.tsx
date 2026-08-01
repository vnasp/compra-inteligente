"use client";

export type PurchasePhase = "prepare" | "proposal" | "cart" | "completed";
export type FlowStepStatus = "completed" | "current" | "pending";

export interface FlowStep {
  label: string;
  status: FlowStepStatus;
}

interface PurchaseFlowCardProps {
  phase: PurchasePhase;
  title: string;
  description: string;
  statusLabel: string;
  steps: FlowStep[];
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCta: () => void;
  secondaryActions: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }[];
}

export function PurchaseFlowCard({
  phase,
  title,
  description,
  statusLabel,
  steps,
  ctaLabel,
  ctaDisabled,
  onCta,
  secondaryActions,
}: PurchaseFlowCardProps) {
  return (
    <div className="app-card">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={
                phase === "completed" ? "badge-success" : "badge-brand"
              }
            >
              {statusLabel}
            </span>
          </div>
          <h2 className="text-text-primary text-xl font-bold">{title}</h2>
          <p className="text-text-secondary mt-1 text-sm leading-snug">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            onClick={onCta}
            disabled={ctaDisabled}
            className={
              phase === "completed" ? "button-secondary" : "button-success"
            }
          >
            {ctaLabel}
          </button>
          {secondaryActions.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {secondaryActions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="button-secondary px-3 py-1.5 text-xs"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-5 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, idx) => (
          <div
            key={step.label}
            className={`flow-step flow-step-${step.status}`}
          >
            <span className="flow-step-marker">
              {step.status === "completed" ? "✓" : idx + 1}
            </span>
            <span className="truncate">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
