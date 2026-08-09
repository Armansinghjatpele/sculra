import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from './Input';

export interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: {
    category: string;
    links: { title: string; href: string; description?: string }[];
  }[];
}

export function CommandMenu({ isOpen, onClose, items }: CommandMenuProps) {
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open menu via external event or state if needed
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Simple filtering logic
  const filteredItems = items
    .map((cat) => {
      const filteredLinks = cat.links.filter(
        (l) =>
          l.title.toLowerCase().includes(search.toLowerCase()) ||
          l.description?.toLowerCase().includes(search.toLowerCase())
      );
      return { ...cat, links: filteredLinks };
    })
    .filter((cat) => cat.links.length > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/85 backdrop-blur-sm"
          />

          {/* Menu Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.15 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-2xl glass-panel"
          >
            {/* Search Input */}
            <div className="border-b border-border p-3">
              <Input
                placeholder="Type a command or search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto p-2">
              {filteredItems.length > 0 ? (
                filteredItems.map((category, index) => (
                  <div key={index} className="mb-4 last:mb-0">
                    <h3 className="px-2 mb-1.5 text-4xs font-semibold text-muted-foreground uppercase tracking-widest">
                      {category.category}
                    </h3>
                    <div className="space-y-0.5">
                      {category.links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.href}
                          onClick={onClose}
                          className="flex flex-col rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted/75 transition-all select-none cursor-pointer"
                        >
                          <span className="font-medium">{link.title}</span>
                          {link.description && (
                            <span className="text-3xs text-muted-foreground mt-0.5">
                              {link.description}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No matching commands found.
                </div>
              )}
            </div>

            {/* Footer help layout */}
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2 text-4xs text-muted-foreground select-none">
              <span>Use ESC to close</span>
              <div className="flex gap-1.5">
                <span className="rounded bg-muted px-1.5 py-0.5 border border-border">⌘K</span>
                <span>or</span>
                <span className="rounded bg-muted px-1.5 py-0.5 border border-border">Ctrl+K</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
