'use client';

import { createContext, useContext } from 'react';
import type { Namespace } from './get-dictionary';

type Dicts = Partial<Record<Namespace, Record<string, unknown>>>;

const DictionaryContext = createContext<Dicts>({});

export function DictionaryProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Dicts;
}) {
  return (
    <DictionaryContext.Provider value={value}>
      {children}
    </DictionaryContext.Provider>
  );
}

function resolvePath(obj: Record<string, unknown> | undefined, path: string): string {
  if (!obj) return path;
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

export function useT<N extends Namespace>(ns: N) {
  const dicts = useContext(DictionaryContext);
  const dict = dicts[ns] as Record<string, unknown> | undefined;
  return (key: string, vars?: Record<string, string | number>): string => {
    const resolved = resolvePath(dict, key);
    return interpolate(resolved, vars);
  };
}