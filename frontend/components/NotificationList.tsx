'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Button } from './Button';
import { Notification } from '@/lib/demoData';

export function NotificationList({ notifications: initialNotifications }: { notifications: Notification[] }) {
  const [notifications, setNotifications] = React.useState(initialNotifications);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <Card className="glass-panel w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/30 mb-4">
        <div>
          <CardTitle className="text-base font-bold">Unread Notifications</CardTitle>
        </div>
        <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
          Mark all as read
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {notifications.length > 0 ? (
          <div className="divide-y divide-border/30">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                className={`flex items-start justify-between p-4 transition-colors cursor-pointer select-none ${
                  notif.read ? 'bg-transparent' : 'bg-accent/5 hover:bg-accent/10 border-l-2 border-accent'
                }`}
              >
                <div className="space-y-1 pr-6">
                  <p className={`text-xs font-semibold ${notif.read ? 'text-foreground/80' : 'text-foreground'}`}>
                    {notif.title}
                  </p>
                  <p className="text-3xs text-muted-foreground leading-normal">{notif.description}</p>
                </div>
                <span className="text-4xs text-muted-foreground shrink-0">{notif.createdAt}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No notifications found.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
