'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data found',
  emptyAction,
}: DataTableProps<T>) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground mb-4">{emptyMessage}</p>
          {emptyAction && (
            <button onClick={emptyAction.onClick} className="text-primary font-medium hover:underline">
              {emptyAction.label}
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="hidden md:table w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th key={col.key} className={`text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3 px-3 ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={`border-b border-border/50 hover:bg-accent transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`py-3 px-3 text-sm text-foreground/85 ${col.className || ''}`}>
                  {col.render ? col.render(item) : String(item[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="md:hidden space-y-3">
        {data.map((item) => {
          const key = keyExtractor(item);
          const isExpanded = expandedRow === key;
          return (
            <Card
              key={key}
              className="cursor-pointer"
              onClick={() => {
                if (onRowClick) onRowClick(item);
                else setExpandedRow(isExpanded ? null : key);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-primary font-medium text-sm">
                    {columns[0].render ? columns[0].render(item) : String(item[columns[0].key] ?? '')}
                  </span>
                  <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {columns.slice(1, 4).map((col) => (
                    <span key={col.key}>
                      {col.render ? col.render(item) : String(item[col.key] ?? '')}
                    </span>
                  ))}
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {columns.slice(4).map((col) => (
                          <div key={col.key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{col.label}</span>
                            <span className="text-foreground/85">
                              {col.render ? col.render(item) : String(item[col.key] ?? '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}