'use client';

// ==============================================================================
// Sculra Production Notification Center (/notifications)
// (frontend/app/(authenticated)/notifications/page.tsx)
// ==============================================================================

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Stack } from '@/components/LayoutPrimitives';
import { Notification } from '@/lib/demoData';

export default function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [filterSeverity, setFilterSeverity] = React.useState<string>('ALL');
  const [filterRead, setFilterRead] = React.useState<'ALL' | 'UNREAD'>('ALL');

  const fetchNotifications = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || []);
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    } catch {
      // Revert if error
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
    } catch {
      fetchNotifications();
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterRead === 'UNREAD' && n.read) return false;
    if (filterSeverity !== 'ALL' && n.severity !== filterSeverity) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Stack spacing={24} className="max-w-5xl mx-auto py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Notification Center</h1>
            {unreadCount > 0 && (
              <Badge variant="danger" className="text-xs px-2 py-0.5">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time alerting, release gate notifications, and incident triggers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/settings/notifications">
            <Button variant="outline" size="sm" className="text-xs">
              Notification Settings
            </Button>
          </Link>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border/20">
        <div className="flex items-center rounded-lg bg-accent/10 p-0.5 text-xs">
          <button
            onClick={() => setFilterRead('ALL')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterRead === 'ALL'
                ? 'bg-background text-foreground shadow-xs font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilterRead('UNREAD')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterRead === 'UNREAD'
                ? 'bg-background text-foreground shadow-xs font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="h-4 w-px bg-border/40 mx-2 hidden sm:block" />

        <div className="flex items-center gap-1 text-xs">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterSeverity === sev
                  ? 'bg-accent/20 text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List Card */}
      <Card className="glass-panel w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            {filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
              Loading notifications...
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="divide-y divide-border/20">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex flex-col sm:flex-row items-start justify-between p-4 transition-colors gap-3 ${
                    notif.read
                      ? 'bg-transparent'
                      : 'bg-primary/5 hover:bg-primary/10 border-l-2 border-primary'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">
                        {notif.title}
                      </span>
                      {notif.severity && (
                        <Badge
                          variant={
                            notif.severity === 'CRITICAL'
                              ? 'danger'
                              : notif.severity === 'HIGH'
                              ? 'warning'
                              : 'secondary'
                          }
                          className="text-4xs px-1.5 py-0"
                        >
                          {notif.severity}
                        </Badge>
                      )}
                      <span className="text-4xs text-muted-foreground font-mono">
                        {notif.type}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {notif.description}
                    </p>

                    {notif.projectId && (
                      <div className="pt-1 flex items-center gap-2 text-3xs text-muted-foreground">
                        <span>Project: {notif.projectId}</span>
                        {notif.entityType && notif.entityId && (
                          <span>• {notif.entityType}: {notif.entityId}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 gap-2">
                    <span className="text-3xs text-muted-foreground">
                      {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className="flex items-center gap-2">
                      {!notif.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notif.id)}
                          className="text-3xs h-7 px-2"
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No notifications yet.
            </div>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
