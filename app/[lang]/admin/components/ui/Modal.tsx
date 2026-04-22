'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { XIcon } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = 'sm:max-w-lg' }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        className={`${maxWidth} max-h-[90vh] overflow-y-auto`}
        showCloseButton={false}
      >
        {title && (
          <DialogHeader className="border-b border-border pb-4 mb-2">
            <DialogTitle className="font-playfair text-lg">{title}</DialogTitle>
            <DialogClose className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}