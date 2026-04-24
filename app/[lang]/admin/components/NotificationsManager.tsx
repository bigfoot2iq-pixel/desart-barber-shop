'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, AdminBadge, useToast, DataTable } from './ui';
import { formatDateTime } from '@/lib/i18n/format';
import { useT } from '@/lib/i18n/client-dictionary';
import type { Locale } from '@/lib/i18n/config';

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

interface NotificationsManagerProps {
  lang: Locale;
}

export default function NotificationsManager({ lang }: NotificationsManagerProps) {
  const tAdmin = useT('admin');
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [customerSettings, setCustomerSettings] = useState<CustomerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelRow | null>(null);
  const [creatingChannel, setCreatingChannel] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingChannel, setSavingChannel] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [togglingCustomer, setTogglingCustomer] = useState(false);
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
      toast(tAdmin('notifications.toastLoadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!channel || savingChannel) return;
    setSavingChannel(true);

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
        toast(data.error ?? tAdmin('notifications.toastSaveFailed'), 'error');
        return;
      }

      toast(editingChannel ? tAdmin('notifications.toastChannelUpdated') : tAdmin('notifications.toastChannelCreated'));
      setEditModalOpen(false);
      setEditingChannel(null);
      setCreatingChannel(null);
      loadData();
    } catch {
      toast(tAdmin('notifications.toastChannelSaveFailed'), 'error');
    } finally {
      setSavingChannel(false);
    }
  };

  const handleDelete = async (channel: ChannelRow) => {
    if (deletingId === channel.id) return;
    setDeletingId(channel.id);
    try {
      const res = await fetch(`/api/notifications/channels/${channel.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? tAdmin('notifications.toastSaveFailed'), 'error');
        return;
      }
      toast(tAdmin('notifications.toastChannelDeleted'));
      loadData();
    } catch {
      toast(tAdmin('notifications.toastChannelDeleteFailed'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (channel: ChannelRow) => {
    if (togglingId === channel.id) return;
    setTogglingId(channel.id);
    try {
      const res = await fetch(`/api/notifications/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !channel.is_enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? tAdmin('notifications.toastToggleFailed'), 'error');
        return;
      }
      loadData();
    } catch {
      toast(tAdmin('notifications.toastToggleFailed'), 'error');
    } finally {
      setTogglingId(null);
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
        toast(data.error ?? tAdmin('notifications.toastTestFailed'), 'error');
        return;
      }
      toast(tAdmin('notifications.toastTestSent'));
    } catch {
      toast(tAdmin('notifications.toastTestFailed'), 'error');
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
        toast(data.error ?? tAdmin('notifications.toastRetryFailed'), 'error');
        return;
      }
      toast(tAdmin('notifications.toastRetrySent'));
      loadData();
    } catch {
      toast(tAdmin('notifications.toastRetryFailed'), 'error');
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
    if (savingCustomer) return;
    setSavingCustomer(true);
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
        toast(data.error ?? tAdmin('notifications.toastCustomerSaveFailed'), 'error');
        return;
      }
      toast(customerSettings ? tAdmin('notifications.toastCustomerSettingsUpdated') : tAdmin('notifications.toastCustomerSettingsCreated'));
      setCustomerForm((prev) => ({ ...prev, resend_api_key: '' }));
      loadData();
    } catch {
      toast(tAdmin('notifications.toastCustomerSaveFailed'), 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCustomerTest = async () => {
    if (!customerTestEmail.trim()) {
      toast(tAdmin('notifications.toastEnterEmail'), 'error');
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
        toast(data.error ?? tAdmin('notifications.toastTestFailed'), 'error');
        return;
      }
      toast(tAdmin('notifications.toastTestSent'));
      setCustomerTestEmail('');
    } catch {
      toast(tAdmin('notifications.toastTestFailed'), 'error');
    } finally {
      setTestLoading(null);
    }
  };

  const handleCustomerToggle = async () => {
    if (togglingCustomer) return;
    setTogglingCustomer(true);
    try {
      const res = await fetch('/api/notifications/customer-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !customerForm.is_enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? tAdmin('notifications.toastToggleFailed'), 'error');
        return;
      }
      loadData();
    } catch {
      toast(tAdmin('notifications.toastToggleFailed'), 'error');
    } finally {
      setTogglingCustomer(false);
    }
  };

  const renderChannelForm = () => {
    const channel = creatingChannel ?? editingChannel?.channel;
    if (!channel) return null;

    const fields: Record<string, { key: string; labelKey: string; placeholderKey: string; type?: string }[]> = {
      email: [
        { key: 'api_key', labelKey: 'notifications.fieldApiKey', placeholderKey: 'notifications.fieldApiKeyPlaceholder', type: 'password' },
        { key: 'from', labelKey: 'notifications.fieldFrom', placeholderKey: 'notifications.fieldFromPlaceholder' },
        { key: 'to', labelKey: 'notifications.fieldTo', placeholderKey: 'notifications.fieldToPlaceholder' },
      ],
      telegram: [
        { key: 'bot_token', labelKey: 'notifications.fieldBotToken', placeholderKey: 'notifications.fieldBotTokenPlaceholder', type: 'password' },
        { key: 'chat_id', labelKey: 'notifications.fieldChatId', placeholderKey: 'notifications.fieldChatIdPlaceholder' },
      ],
      whatsapp: formProvider === 'whatsapp_cloud'
        ? [
            { key: 'access_token', labelKey: 'notifications.fieldAccessToken', placeholderKey: 'notifications.fieldAccessTokenPlaceholder', type: 'password' },
            { key: 'phone_number_id', labelKey: 'notifications.fieldPhoneNumberId', placeholderKey: 'notifications.fieldPhoneNumberIdPlaceholder' },
            { key: 'to', labelKey: 'notifications.fieldTo', placeholderKey: 'notifications.fieldToPlaceholder' },
            { key: 'template_name', labelKey: 'notifications.fieldTemplateName', placeholderKey: 'notifications.fieldTemplateNamePlaceholder' },
            { key: 'template_lang', labelKey: 'notifications.fieldTemplateLang', placeholderKey: 'notifications.fieldTemplateLangPlaceholder' },
          ]
        : [
            { key: 'phone', labelKey: 'notifications.fieldPhone', placeholderKey: 'notifications.fieldPhonePlaceholder' },
            { key: 'api_key', labelKey: 'notifications.fieldApiKey', placeholderKey: 'notifications.fieldApiKeyPlaceholder', type: 'password' },
          ],
    };

    return (
      <div className="space-y-4">
        {channel === 'whatsapp' && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{tAdmin('notifications.providerLabel')}</Label>
            <select
              value={formProvider}
              onChange={(e) => setFormProvider(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="callmebot">{tAdmin('notifications.callmebotProvider')}</option>
              <option value="whatsapp_cloud">{tAdmin('notifications.whatsappCloudProvider')}</option>
            </select>
          </div>
        )}

        {(fields[channel] ?? []).map((field) => {
          const isSecret = ['api_key', 'bot_token', 'access_token'].includes(field.key);
          const alreadySet = editingChannel && isSecret && (editingChannel.config as Record<string, unknown>)[field.key] === '__set__';
          return (
            <div key={field.key}>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {tAdmin(field.labelKey)}
                {alreadySet && <span className="text-green-400 ml-2 font-normal">{tAdmin('notifications.fieldApiKeyAlreadySet')}</span>}
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
                placeholder={alreadySet ? tAdmin('notifications.fieldApiKeyKeepCurrent') : tAdmin(field.placeholderKey)}
                className="mt-1"
              />
            </div>
          );
        })}

        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
            {tAdmin('notifications.eventSubscriptions')}
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
      label: tAdmin('notifications.columnEvent'),
      render: (item: DeliveryRow) => (
        <span className="text-foreground/85 text-xs">
          {tAdmin(`notifications.events.${(item.event_type as string).replace('appointment.', '')}`)}
        </span>
      ),
    },
    {
      key: 'recipient_kind',
      label: tAdmin('notifications.columnRecipient'),
      render: (item: DeliveryRow) => (
        <AdminBadge variant={item.recipient_kind === 'customer' ? 'confirmed' : 'inactive'}>
          {item.recipient_kind ?? tAdmin('notifications.recipientAdmin')}
        </AdminBadge>
      ),
    },
    {
      key: 'channel',
      label: tAdmin('notifications.columnChannel'),
      render: (item: DeliveryRow) => (
        <span className="text-foreground/85 text-xs">
          {item.channel?.channel ? `${item.channel.channel} / ${item.channel.provider}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: tAdmin('notifications.columnStatus'),
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
          {tAdmin(`notifications.statusLabel.${item.status}`)}
        </AdminBadge>
      ),
    },
    {
      key: 'created_at',
      label: tAdmin('notifications.columnCreated'),
      render: (item: DeliveryRow) => (
        <span className="text-muted-foreground text-xs">
          {formatDateTime(new Date(item.created_at), lang)}
        </span>
      ),
    },
    {
      key: 'last_error',
      label: tAdmin('notifications.columnError'),
      className: 'max-w-[180px]',
      render: (item: DeliveryRow) => (
        <span className="text-red-400 text-xs inline-block truncate max-w-full" title={item.last_error ?? ''}>
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
            {retryLoading === item.id ? tAdmin('notifications.retrying') : tAdmin('notifications.retry')}
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
    { key: 'email', labelKey: 'notifications.channels.email', provider: 'resend' },
    { key: 'whatsapp', labelKey: 'notifications.channels.whatsapp', provider: 'callmebot' },
    { key: 'telegram', labelKey: 'notifications.channels.telegram', provider: 'telegram_bot' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {channelCards.map(({ key, labelKey, provider }) => {
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
                  <h3 className="font-medium text-foreground">{tAdmin(labelKey)}</h3>
                  {existing && (
                    <AdminBadge variant={existing.is_enabled ? 'confirmed' : 'inactive'}>
                      {existing.is_enabled ? tAdmin('notifications.enabled') : tAdmin('notifications.disabled')}
                    </AdminBadge>
                  )}
                </div>

                {existing ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {tAdmin('notifications.provider', { name: existing.provider })}
                    </p>
                    {Object.entries(existing.config)
                      .filter(([, v]) => v !== '__set__')
                      .map(([k, v]) => (
                        <p key={k} className="text-xs text-muted-foreground">
                          {k}: {String(v)}
                        </p>
                      ))}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Button size="sm" onClick={() => openEditModal(existing)}>{tAdmin('notifications.edit')}</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(existing.id)}
                        disabled={testLoading === existing.id}
                      >
                        {testLoading === existing.id ? tAdmin('notifications.sending') : tAdmin('notifications.sendTest')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggle(existing)}
                        disabled={togglingId === existing.id}
                      >
                        {togglingId === existing.id
                          ? tAdmin('notifications.toggling')
                          : existing.is_enabled ? tAdmin('notifications.disable') : tAdmin('notifications.enable')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(existing)}
                        disabled={deletingId === existing.id}
                      >
                        {deletingId === existing.id ? tAdmin('notifications.deleting') : tAdmin('notifications.delete')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => openCreateModal(key)} className="mt-2">
                    {tAdmin('notifications.setUpChannel', { channel: tAdmin(labelKey) })}
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
            <h3 className="font-medium text-foreground">{tAdmin('notifications.customerNotifications')}</h3>
            <AdminBadge variant={customerForm.is_enabled ? 'confirmed' : 'inactive'}>
              {customerForm.is_enabled ? tAdmin('notifications.customerEnabled') : tAdmin('notifications.customerDisabled')}
            </AdminBadge>
          </div>

          <div className="space-y-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCustomerToggle}
              disabled={togglingCustomer || (!customerSettings?.has_api_key && !customerForm.resend_api_key)}
              title={!customerSettings?.has_api_key && !customerForm.resend_api_key ? tAdmin('notifications.customerToggleDisabled') : ''}
            >
              {togglingCustomer
                ? tAdmin('notifications.toggling')
                : customerForm.is_enabled ? tAdmin('notifications.disable') : tAdmin('notifications.enable')}
            </Button>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {tAdmin('notifications.resendApiKey')}
              </Label>
              <Input
                type="password"
                value={customerForm.resend_api_key}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, resend_api_key: e.target.value }))}
                placeholder={customerSettings?.has_api_key ? tAdmin('notifications.fieldApiKeyKeepCurrent') : tAdmin('notifications.resendApiKeyPlaceholder')}
                className="mt-1"
              />
              {customerSettings?.has_api_key && !customerForm.resend_api_key && (
                <p className="text-xs text-muted-foreground mt-1">{tAdmin('notifications.customerApiKeySet')}</p>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {tAdmin('notifications.fromAddress')}
              </Label>
              <Input
                type="text"
                value={customerForm.from_address}
                onChange={(e) => setCustomerForm((prev) => ({ ...prev, from_address: e.target.value }))}
                placeholder={tAdmin('notifications.fromAddressPlaceholder')}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
                {tAdmin('notifications.eventSubscriptions')}
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
                <span className="text-foreground/85">{tAdmin(`notifications.events.${event.replace('appointment.', '')}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {tAdmin('notifications.sendTestEmail')}
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="email"
                  value={customerTestEmail}
                  onChange={(e) => setCustomerTestEmail(e.target.value)}
                  placeholder={tAdmin('notifications.testEmailPlaceholder')}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCustomerTest}
                  disabled={testLoading === 'customer-test'}
                >
                  {testLoading === 'customer-test' ? tAdmin('notifications.sending') : tAdmin('notifications.sendTest')}
                </Button>
              </div>
            </div>

            <Button size="sm" onClick={handleCustomerSave} disabled={savingCustomer}>
              {savingCustomer ? tAdmin('notifications.saving') : tAdmin('notifications.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-playfair text-lg text-foreground">{tAdmin('notifications.deliveryLog')}</h3>
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
                  {filter === 'all' ? tAdmin('notifications.filterAll') : filter === 'admin' ? tAdmin('notifications.filterAdmin') : tAdmin('notifications.filterCustomer')}
                </button>
              ))}
            </div>
          </div>
          <DataTable
            columns={deliveryColumns as never}
            data={filteredDeliveries as unknown as Record<string, unknown>[]}
            keyExtractor={(item) => String(item.id)}
            emptyMessage={tAdmin('notifications.noDeliveries')}
          />
        </CardContent>
      </Card>

      <Modal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingChannel(null); setCreatingChannel(null); }}
        title={editingChannel ? tAdmin('notifications.editChannelTitle') : tAdmin('notifications.setupTitle', { channel: creatingChannel ? tAdmin(`notifications.channels.${creatingChannel}`) : '' })}
      >
        {renderChannelForm()}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="outline"
            onClick={() => { setEditModalOpen(false); setEditingChannel(null); setCreatingChannel(null); }}
          >
            {tAdmin('notifications.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={savingChannel}>
            {savingChannel ? tAdmin('notifications.saving') : tAdmin('notifications.save')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}