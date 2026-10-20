'use client';
import { useId, useMemo, useState } from 'react';
import { pointOfNeedHelp } from '@/lib/saha/point-of-need-help';
import './point-of-need-help.css';

export function PointOfNeedHelp({ task, step, actorRole, sourceAvailable = true }: {
  task: string; step: string; actorRole: string; sourceAvailable?: boolean;
}) {
  const contextKey = [task, step, actorRole, sourceAvailable ? 'available' : 'unavailable'].join(':');
  return <PointOfNeedHelpContext key={contextKey} task={task} step={step} actorRole={actorRole} sourceAvailable={sourceAvailable} />;
}

function PointOfNeedHelpContext({ task, step, actorRole, sourceAvailable }: {
  task: string; step: string; actorRole: string; sourceAvailable: boolean;
}) {
  const [open, setOpen] = useState(false), panelId = useId();
  const help = useMemo(() => pointOfNeedHelp({ task, step, actorRole, sourceAvailable }), [task, step, actorRole, sourceAvailable]);
  if (help.kind === 'refused') return null;
  return <aside className="point-help" aria-label="Optional task help">
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      {open ? 'Close optional help' : 'Need help with this step?'}
    </button>
    {open && <div id={panelId} className="point-help-content" role="note">
      {help.kind === 'available' ? <><h4>{help.title}</h4><ol>{help.instructions.map(line => <li key={line}>{line}</li>)}</ol></> : <p role="status">{help.message}</p>}
      <p>{help.manualPath}</p>
      <small>Source: {help.source.label} v{help.source.version} · {help.source.provenance}</small>
    </div>}
  </aside>;
}
