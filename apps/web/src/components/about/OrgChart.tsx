'use client';
/**
 * Interactive organisation chart. Rendered as a nested list (a tree) so it is
 * fully usable with keyboard and screen readers; nodes expand/collapse.
 */
import { useState } from 'react';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import type { OrgNode } from '@armyx/shared/content';

function Node({ node, depth, expanded, toggle }: { node: OrgNode; depth: number; expanded: Set<string>; toggle: (id: string) => void }) {
  const has = !!node.children?.length;
  const open = expanded.has(node.id);
  return (
    <li role="treeitem" aria-expanded={has ? open : undefined} aria-level={depth + 1} className="relative">
      <div className={`flex items-center gap-2 ${depth > 0 ? 'before:absolute before:top-6 before:-left-5 before:h-px before:w-5 before:bg-khaki-500' : ''}`}>
        {has ? (
          <button type="button" onClick={() => toggle(node.id)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition sm:w-auto sm:min-w-72 ${depth === 0 ? 'border-olive-900 bg-olive-900 text-white' : depth < 3 ? 'border-olive-700 bg-olive-700 text-white' : 'border-olive-100 bg-white'}`}>
            <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gold-500 text-olive-950">{open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>
            <span><span className="block font-semibold">{node.title}</span>{node.subtitle && <span className={`block text-xs ${depth < 3 ? 'text-khaki-100' : 'text-muted'}`}>{node.subtitle}</span>}</span>
          </button>
        ) : (
          <div className="flex w-full items-center gap-3 rounded-lg border border-olive-100 bg-white p-3 sm:w-auto sm:min-w-72">
            <ChevronRight aria-hidden className="h-4 w-4 text-gold-600" />
            <span><span className="block font-semibold text-olive-900">{node.title}</span>{node.subtitle && <span className="block text-xs text-muted">{node.subtitle}</span>}</span>
          </div>
        )}
      </div>
      {has && open && (
        <ul role="group" className="mt-2 ml-5 space-y-2 border-l border-khaki-500 pl-5">
          {node.children!.map((c) => <Node key={c.id} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} />)}
        </ul>
      )}
    </li>
  );
}

const allIds = (n: OrgNode): string[] => [n.id, ...(n.children ?? []).flatMap(allIds)];

export function OrgChart({ root }: { root: OrgNode }) {
  const [expanded, setExpanded] = useState(() => new Set(['cic', 'cds', 'coas']));
  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" className="btn-outline" onClick={() => setExpanded(new Set(allIds(root)))}>Expand all</button>
        <button type="button" className="btn-outline" onClick={() => setExpanded(new Set(['cic']))}>Collapse all</button>
      </div>
      <ul role="tree" aria-label="Nigerian Army organisation" className="space-y-2">
        <Node node={root} depth={0} expanded={expanded} toggle={toggle} />
      </ul>
    </div>
  );
}
