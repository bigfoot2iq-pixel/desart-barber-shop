'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, AdminBadge, useToast, DataTable } from './ui';

interface ChannelRow {
  id: string;
  admin_id: string;
  channel: string;
  provider: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  events: string[];
  created_at: string;
  updated_at: string;
}

interface DeliveryRow {
  id: string;
  appointment_id: string;
  event_type: string;
  channel_id: string;
  recipient_kind: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  channel: { channel: string; provider: string } | null;
}

interface CustomerSettings {
  id: string;
  is_enabled: boolean;
  from_address: string;
  events: string[];
  has_api_key: boolean;
  created_at: string;
  updated_at: string;
}

const CUSTOMER_EVENTS = [
  'appointment.confirmed',
  'appointment.cancelled',
];

const ALL_EVENTS = [
  'appointment.created',
  'appointment.confirmed',
  'appointment.cancelled',
  'appointment.completed',
  'appointment.professional_assigned',
];

const CHANNEL_ICONS: Record<string, string> = {
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  whatsapp: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
  telegram: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
};

const PROVIDER_LABELS: Record<string, string> = {
  resend: 'Resend',
  telegram_bot: 'Telegram Bot',
  callmebot: 'CallMeBot',
  whatsapp_cloud: 'WhatsApp Cloud',
};

export default function NotificationsManager() {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [customerSettings, setCustomerSettings] = useState<CustomerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelRow | null>(null);
  const [creatingChannel, setCreatingChannel] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState<string | null>(null);
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [formEvents, setFormEvents] = useState<string[]>(ALL_EVENTS);
  const [formProvider, setFormProvider] = useState<string>('callmebot');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'admin' | 'customer'>('all');
  const [customerForm, setCustomerForm] = useState({
    is_enabled: false,
    resend_api_key: '',
    from_address: '',
    events: [...CUSTOMER_EVENTS],
  });
  const [customerTestEmail, setCustomerTestEmail] = useState('');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [channelsRes, deliveriesRes, customerRes] = await Promise.all([
        fetch('/api/notifications/channels'),
        fetch('/api/notifications/deliveries'),
        fetch('/api/notifications/customer-settings'),
      ]);
      const channelsData = await channelsRes.json();
      const deliveriesData = await deliveriesRes.json();
      const customerData = await customerRes.json();
      if (channelsRes.ok) setChannels(channelsData.channels ?? []);
      if (deliveriesRes.ok) setDeliveries(deliveriesData.deliveries ?? []);
      if (customerRes.ok) setCustomerSettings(customerData.settings ?? null);
    } catch {
      toast('Failed to load notification data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (customerSettings) {
      setCustomerForm({
        is_enabled: customerSettings.is_enabled,
        resend_api_key: '',
        from_address: customerSettings.from_address,
        events: [...customerSettings.events],
      });
    }
  }, [customerSettings]);

  const openCreateModal = (channel: string) => {
    setCreatingChannel(channel);
    setEditingChannel(null);
    setFormConfig({});
    setFormEvents([...ALL_EVENTS]);
    setFormProvider(channel === 'whatsapp' ? 'callmebot' : channel === 'email' ? 'resend' : 'telegram_bot');
    setEditModalOpen(true);
  };

  const openEditModal = (channel: ChannelRow) => {
    setEditingChannel(channel);
    setCreatingChannel(null);
    setFormConfig(
      Object.fromEntries(
        Object.entries(channel.config)
          .filter(([, v]) => v !== '__set__')
          .map(([k, v]) => [k, String(v)])
      )
    );
    setFormEvents([...channel.events]);
    setFormProvider(channel.provider);
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    const channel = creatingChannel ?? editingChannel?.channel;
    if (!channel) return;

    const sanitizedConfig = { ...formConfig };
    if (editingChannel) {
      for (const [key, value] of Object.entries(sanitizedConfig)) {
        if (typeof value === 'string' && !value.trim()) {
          delete sanitizedConfig[key];
        }
      }
    }

    const body: Record<string, unknown> = {
      channel,
      provider: formProvider,
      config: sanitizedConfig,
      events: formEvents,
    };

    try {
      let res: Response;
      if (editingChannel) {
        const sanitizedPatchConfig = { ...formConfig };
        for (const [key, value] of Object.entries(sanitizedPatchConfig)) {
          if (typeof value === 'string' && !value.trim()) {
            delete sanitizedPatchConfig[key];
          }
        }
        res = await fetch(`/api/notifications/channels/${editingChannel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: sanitizedPatchConfig, events: formEvents }),
        });
      } else {
        res = await fetch('/api/notifications/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Failed to save', 'error');
        return;
      }

      toast(editingChannel ? 'Channel updated' : 'Channel created');
      setEditModalOpen(false);
      setEditingChannel(null);
      setCreatingChannel(null);
      loadData();
    } catch {
      toast('Failed to save channel', 'error');
    }
  };

  const handleDelete = async (channel: ChannelRow) => {
    try {
      const res = await fetch(`/api/notifications/channels/${channel.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? 'Failed to delete', 'error');
        return;
      }
      toast('Channel deleted');
      loadData();
    } catch {
      toast('Failed to delete channel', 'error');
    }
  };

  const handleToggle = async (channel: ChannelRow) => {
    try {
      const res = await fetch(`/api/notifications/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !channel.is_enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? 'Failed to toggle', 'error');
        return;
      }
      loadData();
    } catch {
      toast('Failed to toggle channel', 'error');
    }
  };

  const handleTest = async (channelId: string) => {
    setTestLoading(channelId);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Test failed', 'error');
        return;
      }
      toast('Test message sent');
    } catch {
      toast('Test failed', 'error');
    } finally {
      setTestLoading(null);
    }
  };

  const handleRetry = async (deliveryId: string) => {
    setRetryLoading(deliveryId);
    try {
      const res = await fetch(`/api/notifications/deliveries/${deliveryId}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Retry failed', 'error');
        return;
      }
      toast('Retry sent');
      loadData();
    } catch {
      toast('Retry failed', 'error');
    } finally {
      setRetryLoading(null);
    }
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const toggleCustomerEvent = (event: string) => {
    setCustomerForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCustomerSave = async () => {
    const body: Record<string, unknown> = {
      is_enabled: customerForm.is_enabled,
      from_address: customerForm.from_address,
      events: customerForm.events,
    };
    if (customerForm.resend_api_key.trim()) {
      body.resend_api_key = customerForm.resend_api_key;
    }

    try {
      const res = await fetch('/api/notifications/customer-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Failed to save', 'error');
        return;
      }
      toast(customerSettings ? 'Customer settings updated' : 'Customer settings created');
      setCustomerForm((prev) => ({ ...prev, resend_api_key: '' }));
      loadData();
    } catch {
      toast('Failed to save customer settings', 'error');
    }
  };

  const handleCustomerTest = async () => {
    if (!customerTestEmail.trim()) {
      toast('Enter a recipient email', 'error');
      return;
    }
    setTestLoading('customer-test');
    try {
      const res = await fetch('/api/notifications/customer-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: customerTestEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Test failed', 'error');
        return;
      }
      toast('Test email sent');
      setCustomerTestEmail('');
    } catch {
      toast('Test failed', 'error');
    } finally {
      setTestLoading(null);
    }
  };

  const handleCustomerToggle = async () => {
    try {
      const res = await fetch('/api/notifications/customer-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !customerForm.is_enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? 'Failed to toggle', 'error');
        return;
      }
      loadData();
    } catch {
      toast('Failed to toggle customer notifications', 'error');
    }
  };

  const renderChannelForm = () => {
    const channel = creatingChannel ?? editingChannel?.channel;
    if (!channel) return null;

    const fields: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
      email: [
        { key: 'api_key', label: 'API Key', placeholder: 're_...', type: 'password' },
        { key: 'from', label: 'From', placeholder: 'onboarding@resend.dev' },
        { key: 'to', label: 'To', placeholder: 'admin@example.com' },
      ],
      telegram: [
        { key: 'bot_token', label: 'Bot Token', placeholder: '123:ABC...', type: 'password' },
        { key: 'chat_id', label: 'Chat ID', placeholder: '123456789' },
      ],
      whatsapp: formProvider === 'whatsapp_cloud'
        ? [
            { key: 'access_token', label: 'Access Token', placeholder: 'EAAG...', type: 'password' },
            { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '123...' },
            { key: 'to', label: 'To', placeholder: '212600000000' },
            { key: 'template_name', label: 'Template Name', placeholder: 'appointment_alert' },
            { key: 'template_lang', label: 'Template Language', placeholder: 'en' },
          ]
        : [
            { key: 'phone', label: 'Phone', placeholder: '+212600000000' },
            { key: 'api_key', label: 'API Key', placeholder: '1234567', type: 'password' },
          ],
    };

    return (
      <div className="space-y-4">
        {channel === 'whatsapp' && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Provider</Label>
            <select
              value={formProvider}
              onChange={(e) => setFormProvider(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="callmebot">CallMeBot (quick setup)</option>
              <option value="whatsapp_cloud">WhatsApp Cloud API (Meta)</option>
            </select>
          </div>
        )}

        {(fields[channel] ?? []).map((field) => {
          const isSecret = ['api_key', 'bot_token', 'access_token'].includes(field.key);
          const alreadySet = editingChannel && isSecret && (editingChannel.config as Record<string, unknown>)[field.key] === '__set__';
          return (
            <div key={field.key}>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {field.label}
                {alreadySet && <span className="text-green-400 ml-2 font-normal">(already set)</span>}
              </Label>
              <Input
                type={field.type ?? 'text'}
                value={formConfig[field.key] ?? ''}
                onChange={(e) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                placeholder={alreadySet ? 'Leave blank to keep current value' : field.placeholder}
                className="mt-1"
              />
            </div>
          );
        })}

        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
            Event Subscriptions
          </Label>
          <div className="space-y-2">
            {ALL_EVENTS.map((event) => (
              <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-foreground/85">{event.replace('appointment.', '')}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const deliveryColumns = [
    {
      key: 'event_type',
      label: 'Event',
      render: (item: DeliveryRow) => (
        <span className="text-foreground/85 text-xs">
          {(item.event_type as string).replace('appointment.', '')}
        </span>
      ),
    },
    {
      key: 'recipient_kind',
      label: 'Recipient',
      render: (item: DeliveryRow) => (
        <AdminBadge variant={item.recipient_kind === 'customer' ? 'confirmed' : 'inactive'}>
          {item.recipient_kind ?? 'admin'}
        </AdminBadge>
      ),
    },
    {
      key: 'channel',
      label: 'Channel',
      render: (item: DeliveryRow) => (
        <span className="text-foreground/85 text-xs">
          {item.channel?.channel ? `${item.channel.channel} / ${PROVIDER_LABELS[item.channel?.provider ?? ''] ?? item.channel?.provider}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: DeliveryRow) => (
        <AdminBadge
          variant={
            item.status === 'sent'
              ? 'confirmed'
              : item.status === 'failed'
              ? 'cancelled'
              : 'pending'
          }
        >
          {item.status}
        </AdminBadge>
      ),
    },
    {
      key: 'created_at',
      label: 'Time',
      render: (item: DeliveryRow) => (
        <span className="text-muted-foreground text-xs">
          {new Date(item.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'last_error',
      label: 'Error',
      render: (item: DeliveryRow) => (
        <span className="text-red-400 text-xs truncate max-w-[200px]" title={item.last_error ?? ''}>
          {item.last_error ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: DeliveryRow) =>
        item.status === 'failed' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRetry(item.id)}
            disabled={retryLoading === item.id}
          >
            {retryLoading === item.id ? 'Retrying...' : 'Retry'}
          </Button>
        ) : null,
    },
  ];

  const filteredDeliveries = deliveries.filter((d) => {
    if (deliveryFilter === 'all') return true;
    return d.recipient_kind === deliveryFilter;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const channelCards = [
    { key: 'email', label: 'Email', provider: 'resend' },
    { key: 'whatsapp', label: 'WhatsApp', provider: 'callmebot' },
    { key: 'telegram', label: 'Telegram', provider: 'telegram_bot' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {channelCards.map(({ key, label, provider }) => {
          const existing = channels.find(
            (ch) => ch.channel === key && ch.provider === provider
          );

          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={CHANNEL_ICONS[key]} />
                  </svg>
                  <h3 className="font-medium text-foreground">{label}</h3>
                  {existing && (
                    <AdminBadge variant={existing.is_enabled ? 'confirmed' : 'inactive'}>
                      {existing.is_enabled ? 'Enabled' : 'Disabled'}
                    </AdminBadge>
                  )}
                </div>

                {existing ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Provider: {PROVIDER_LABELS[existing.provider] ?? existing.provider}
                    </p>
                    {Object.entries(existing.config)
                      .filter(([, v]) => v !== '__set__')
                      .map(([k, v]) => (
                        <p key={k} className="text-xs text-muted-foreground">
                          {k}: {String(v)}
                        </p>
                      ))}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => openEditModal(existing)}>Edit</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(existing.id)}
                        disabled={testLoading === existing.id}
                      >
                        {testLoading === existing.id ? 'Sending...' : 'Send Test'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggle(existing)}
                      >
                        {existing.is_enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(existing)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => openCreateModal(key)} className="mt-2">
                    Set up {label}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="font-medium text-foreground">Customer notifications</h3>
            <AdminBadge variant={customerForm.is_enabled ? 'confirmed' : 'inactive'}>
              {customerForm.is_enabled ? 'Enabled' : 'Disabled'}
            </AdminBadge>
          </div>

          <div className="space-y-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCustomerToggle}
            >
              {customerForm.is_enabled ? 'Disable' : 'Enable'}
            </Button>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Resend API Key
              </Label>
              <Input
                type="password"
                value={customerForm.resend_api_key}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, resend_api_key: e.target.value }))}
                placeholder={customerSettings?.has_api_key ? 'Leave blank to keep current value' : 're_...'}
                className="mt-1"
              />
              {customerSettings?.has_api_key && !customerForm.resend_api_key && (
                <p className="text-xs text-muted-foreground mt-1">API key is set</p>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                From address
              </Label>
              <Input
                type="text"
                value={customerForm.from_address}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, from_address: e.target.value }))}
                placeholder="DesArt <no-reply@yourdomain.com>"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
                Event Subscriptions
              </Label>
              <div className="space-y-2">
                {CUSTOMER_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customerForm.events.includes(event)}
                      onChange={() => toggleCustomerEvent(event)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-foreground/85">{event.replace('appointment.', '')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Send test email
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="email"
                  value={customerTestEmail}
                  onChange={(e) => setCustomerTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCustomerTest}
                  disabled={testLoading === 'customer-test'}
                >
                  {testLoading === 'customer-test' ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
            </div>

            <Button size="sm" onClick={handleCustomerSave}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-playfair text-lg text-foreground">Delivery Log</h3>
            <div className="flex gap-1">
              {(['all', 'admin', 'customer'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDeliveryFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    deliveryFilter === filter
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <DataTable
            columns={deliveryColumns as never}
            data={filteredDeliveries as unknown as Record<string, unknown>[]}
            keyExtractor={(item) => String(item.id)}
            emptyMessage="No deliveries yet"
          />
        </CardContent>
      </Card>

      <Modal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingChannel(null); setCreatingChannel(null); }}
        title={editingChannel ? 'Edit Channel' : `Set up ${creatingChannel}`}
      >
        {renderChannelForm()}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="outline"
            onClick={() => { setEditModalOpen(false); setEditingChannel(null); setCreatingChannel(null); }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
