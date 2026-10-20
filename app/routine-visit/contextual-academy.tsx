'use client';
import { useEffect, useState } from 'react';
import type { ContextualAcademy } from '@/lib/saha/contextual-academy';

export default function ContextualAcademyPanel({ learning }: { learning: ContextualAcademy }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setOpen(null); }, [learning]);
  if (learning.status === 'unavailable') return <section aria-label="Optional Aplyd Academy learning">
    <h2>Optional learning</h2>
    <p>Aplyd Academy learning is unavailable for this task. Continue the routine visit normally.</p>
    <p>No learning completion is recorded, and care is never blocked.</p>
  </section>;
  const current = learning.items.find(item => item.id === open) ?? null;
  return <section aria-label="Optional Aplyd Academy learning">
    <h2>Optional learning</h2>
    <p>These source-bound Aplyd Academy items are optional. Opening, closing, or skipping one does not change this person, visit, assignment, or care status.</p>
    {!current ? <ul>{learning.items.map(item => <li key={item.id}>
      <h3>{item.title}</h3><p>{item.summary}</p>
      <p>Source: {item.source.reference} · edition {item.source.edition}</p>
      <button type="button" onClick={() => setOpen(item.id)}>Open optional learning</button>
    </li>)}</ul> : <article aria-label={current.title}>
      <h3>{current.title}</h3><p>{current.content}</p>
      <p>Source: {current.source.reference} · edition {current.source.edition} · content {current.source.contentHash.slice(0, 12)}</p>
      <p>This view has no completion tracking and sends no patient or visit details to Academy.</p>
      <button type="button" onClick={() => setOpen(null)}>Return to routine visit</button>
    </article>}
  </section>;
}
