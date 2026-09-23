'use client';

// ==============================================================================
// Sculra Notification & Alerting Settings Console
// (frontend/app/(authenticated)/settings/notifications/page.tsx)
// ==============================================================================

import * as React from 'react';
import { Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import {
  Bell,
  Mail,
  Webhook,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
} from 'lucide-react';
import { NotificationPreference, NotificationSubscription } from '@/lib/demoData';

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = React.useState<NotificationPreference[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<NotificationSubscription[]>([]);
  const [health, setHealth] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Form states for general preference
  const [minSeverity, setMinSeverity] = React.useState<'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('INFO');
  const [frequency, setFrequency] = React.useState<'IMMEDIATE' | 'HOURLY_DIGEST' | 'DAILY_DIGEST'>('IMMEDIATE');
  const [inAppEnabled, setInAppEnabled] = React.useState(true);
  const [emailEnabled, setEmailEnabled] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [prefRes, subRes] = await Promise.all([
        fetch('/api/notifications/preferences'),
        fetch('/api/notifications/subscriptions'),
      ]);

      if (prefRes.ok) {
        const json = await prefRes.json();
        setPreferences(json.preferences || []);
        if (json.preferences && json.preferences.length > 0) {
          const p = json.preferences[0];
          setMinSeverity(p.min_severity || 'INFO');
          setFrequency(p.frequency || 'IMMEDIATE');
          setInAppEnabled(p.enabled !== false);
        }
      }

      if (subRes.ok) {
        const subJson = await subRes.json();
        setSubscriptions(subJson.subscriptions || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSavePreferences = async () => {
    setSaving(true);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_severity: minSeverity,
          frequency,
          channel: 'IN_APP',
          enabled: inAppEnabled,
        }),
      });

      if (res.ok) {
        setSuccessMessage('Notification preferences updated successfully.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/notifications/subscriptions/${id}`, { method: 'DELETE' });
    } catch {
      fetchData();
    }
  };

  return (
    <Stack spacing={24} className="max-w-4xl mx-auto py-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notification Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Configure alerting policies, channels, subscriptions, and delivery thresholds.
        </p>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Channel Overview */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Active Channels</CardTitle>
          <CardDescription className="text-xs">
            Sculra only reports channels that are strictly configured and verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* In-App */}
            <div className="p-4 rounded-lg bg-accent/5 border border-border/20 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">In-App Alerts</span>
                  </div>
                  <Badge variant="secondary" className="text-4xs">AUTHORITATIVE</Badge>
                </div>
                <p className="text-3xs text-muted-foreground">
                  Persistent notifications stored in PostgreSQL and delivered to your Notification Center.
                </p>
              </div>
              <div className="pt-3">
                <span className="text-3xs font-medium text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Always Enabled
                </span>
              </div>
            </div>

            {/* Email */}
            <div className="p-4 rounded-lg bg-accent/5 border border-border/20 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Email Delivery</span>
                  </div>
                  <Badge variant="outline" className="text-4xs">OPTIONAL</Badge>
                </div>
                <p className="text-3xs text-muted-foreground">
                  Direct email notifications for high and critical events. Requires Vault credential binding.
                </p>
              </div>
              <div className="pt-3">
                <span className="text-3xs font-medium text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> NOT_CONFIGURED
                </span>
              </div>
            </div>

            {/* Webhook */}
            <div className="p-4 rounded-lg bg-accent/5 border border-border/20 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Outbound Webhooks</span>
                  </div>
                  <Badge variant="outline" className="text-4xs">SSRF-PROTECTED</Badge>
                </div>
                <p className="text-3xs text-muted-foreground">
                  HMAC SHA-256 signed POST requests with SSRF filtering and replay protection.
                </p>
              </div>
              <div className="pt-3">
                <span className="text-3xs font-medium text-muted-foreground flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Configured per Project
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Preferences Form */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Alerting Thresholds</CardTitle>
          <CardDescription className="text-xs">
            Control which events interrupt you and set minimum severity levels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Minimum Severity */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              Minimum Alert Severity
            </label>
            <p className="text-3xs text-muted-foreground">
              Events below this severity will not trigger immediate delivery.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setMinSeverity(sev)}
                  className={`p-2.5 rounded-lg border text-xs font-medium text-center transition-all ${
                    minSeverity === sev
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border/30 hover:border-border text-muted-foreground'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Frequency */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              Delivery Frequency
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {[
                { id: 'IMMEDIATE', label: 'Immediate', desc: 'Real-time alert dispatch' },
                { id: 'HOURLY_DIGEST', label: 'Hourly Digest', desc: 'Batched summary hourly' },
                { id: 'DAILY_DIGEST', label: 'Daily Digest', desc: 'Single daily briefing' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFrequency(f.id as any)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    frequency === f.id
                      ? 'border-primary bg-primary/10 text-foreground font-bold'
                      : 'border-border/30 hover:border-border text-muted-foreground'
                  }`}
                >
                  <div className="text-xs">{f.label}</div>
                  <div className="text-4xs text-muted-foreground font-normal mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleSavePreferences}
              disabled={saving}
              className="text-xs flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Management */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Active Subscriptions</CardTitle>
          <CardDescription className="text-xs">
            Entities you have explicitly subscribed to for status notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {subscriptions.length > 0 ? (
            <div className="divide-y divide-border/20">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-4xs">
                        {sub.target_type}
                      </Badge>
                      <span className="font-semibold text-foreground">{sub.target_id}</span>
                    </div>
                    <p className="text-3xs text-muted-foreground mt-0.5">
                      Subscribed on {new Date(sub.created_at).toLocaleDateString()} via {sub.channel}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSubscription(sub.id)}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No active subscriptions yet.
            </div>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
