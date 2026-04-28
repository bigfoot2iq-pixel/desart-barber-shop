'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function SidePanel({ open, onClose, title, children }: SidePanelProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-background shadow-xl sm:w-[480px] lg:w-[520px]"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              {title && (
                <h2 className="font-playfair text-lg font-medium">{title}</h2>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                className="ml-auto shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100"
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
