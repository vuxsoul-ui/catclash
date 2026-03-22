'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Nav from './Nav';

type HeaderSystemContextValue = {
  setExtension: (node: React.ReactNode | null) => void;
};

const HeaderSystemContext = createContext<HeaderSystemContextValue | null>(null);

export function useHeaderExtension(node: React.ReactNode | null) {
  const ctx = useContext(HeaderSystemContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.setExtension(node);
    return () => ctx.setExtension(null);
  }, [ctx, node]);
}

export default function HeaderSystem({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [extension, setExtension] = useState<React.ReactNode | null>(null);
  const showNav = pathname !== '/';

  const value = useMemo(() => ({ setExtension }), []);

  return (
    <HeaderSystemContext.Provider value={value}>
      <div className="header-system">
        {showNav ? <Nav /> : null}
        {extension}
      </div>
      {children}
    </HeaderSystemContext.Provider>
  );
}
