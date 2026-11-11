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
  rowProps?: (row: T) => HTMLAttributes<HTMLTableRowElement> & { draggable?: boolean };
}

/** Dense spreadsheet-like table. Click a header to sort, click again to reverse. */
export function SortableTable<T>({ rows, columns, rowKey, rowClass, initialSort, rowProps }: Props<T>) {
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
        <tbody>
          {sorted.map((r, i) => (
            <tr key={rowKey(r)} {...rowProps?.(r)} className={rowClass?.(r, i, sorted)}>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? 'num' : ''}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
