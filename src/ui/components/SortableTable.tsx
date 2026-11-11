import { useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  title?: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  num?: boolean;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowClass?: (row: T, index: number, sorted: T[]) => string;
  initialSort?: { key: string; dir: 1 | -1 };
  /** Extra attributes / handlers of a row (e.g. drag and drop). */
  rowProps?: (row: T) => HTMLAttributes<HTMLTableRowElement> & Record<`data-${string}`, string>;
  /** Optional sections (one tbody each, with a heading row); rows are sorted within their section. */
  groups?: { id: string; head: ReactNode; empty?: ReactNode; className?: string }[];
  groupOf?: (row: T) => string;
  groupProps?: (id: string) => HTMLAttributes<HTMLTableSectionElement> & Record<`data-${string}`, string>;
}

/** Dense spreadsheet-like table. Click a header to sort, click again to reverse. */
export function SortableTable<T>({ rows, columns, rowKey, rowClass, initialSort, rowProps, groups, groupOf, groupProps }: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return rows.slice().sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [rows, columns, sort]);

  const renderRow = (r: T, i: number, list: T[]) => (
    <tr key={rowKey(r)} {...rowProps?.(r)} className={rowClass?.(r, i, list)}>
      {columns.map((c) => (
        <td key={c.key} className={c.num ? 'num' : ''}>
          {c.render(r)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.sort ? 'sortable' : ''} ${c.num ? 'num' : ''}`}
                title={c.title}
                onClick={() => c.sort && setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.num ? -1 : 1 }))}
              >
                {c.label}
                {sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        {groups && groupOf ? (
          groups.map((g) => {
            const list = sorted.filter((r) => groupOf(r) === g.id);
            return (
              <tbody key={g.id} {...groupProps?.(g.id)} className={`group ${g.className ?? ''} ${groupProps?.(g.id).className ?? ''}`}>
                <tr className="group-head">
                  <td colSpan={columns.length}>{g.head}</td>
                </tr>
                {list.map((r, i) => renderRow(r, i, list))}
                {list.length === 0 && g.empty && (
                  <tr className="group-empty">
                    <td colSpan={columns.length}>{g.empty}</td>
                  </tr>
                )}
              </tbody>
            );
          })
        ) : (
          <tbody>{sorted.map((r, i) => renderRow(r, i, sorted))}</tbody>
        )}
      </table>
    </div>
  );
}
