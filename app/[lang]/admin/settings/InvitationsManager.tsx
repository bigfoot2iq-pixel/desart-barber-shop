'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminBadge, useToast, DataTable } from '../components/ui';
import { formatDateTime } from '@/lib/i18n/format';
import { useT } from '@/lib/i18n/client-dictionary';
import type { Locale } from '@/lib/i18n/config';
import type { InvitationToken } from '@/lib/types/database';

type InvitationStatus = 'pending' | 'expired' | 'accepted';

interface InvitationRow extends Omit<InvitationToken, 'token'> {
  status: InvitationStatus;
}

interface InvitationsManagerProps {
  lang: Locale;
}

function computeStatus(row: { expires_at: string; used_at: string | null }): InvitationStatus {
  if (row.used_at) return 'accepted';
  if (new Date(row.expires_at) < new Date()) return 'expired';
  return 'pending';
}

export default function InvitationsManager({ lang }: InvitationsManagerProps) {
  const tAdmin = useT('admin');
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'professional'>('professional');
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/invitations');
      if (!res.ok) {
        toast(tAdmin('settings.invitations.toastLoadFailed') ?? 'Failed to load invitations', 'error');
        return;
      }
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      toast(tAdmin('settings.invitations.toastLoadFailed') ?? 'Failed to load invitations', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, tAdmin]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast(tAdmin('settings.invitations.toastEmailExists') ?? 'This email already has a pending invite', 'error');
        return;
      }

      if (res.status === 422) {
        toast(tAdmin('settings.invitations.toastEmailNotConfigured') ?? 'Email service is not configured — set it up in Notifications', 'error');
        return;
      }

      if (!res.ok) {
        toast(data.error ?? (tAdmin('settings.invitations.toastSendFailed') ?? 'Failed to send invitation'), 'error');
        return;
      }

      toast(tAdmin('settings.invitations.toastSent') ?? `Invitation sent to ${email}`);
      setEmail('');
      setRole('professional');
      loadInvitations();
    } catch {
      toast(tAdmin('settings.invitations.toastSendFailed') ?? 'Failed to send invitation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (revokingId === id) return;
    setRevokingId(id);
    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? (tAdmin('settings.invitations.toastRevokeFailed') ?? 'Failed to revoke invitation'), 'error');
        return;
      }

      toast(tAdmin('settings.invitations.toastRevoked') ?? 'Invitation revoked');
      loadInvitations();
    } catch {
      toast(tAdmin('settings.invitations.toastRevokeFailed') ?? 'Failed to revoke invitation', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  const columns = [
    {
      key: 'email',
      label: tAdmin('settings.invitations.columnEmail') ?? 'Email',
      render: (item: InvitationRow) => (
        <span className="text-sm text-foreground/85">{item.email}</span>
      ),
    },
    {
      key: 'role',
      label: tAdmin('settings.invitations.columnRole') ?? 'Role',
      render: (item: InvitationRow) => (
        <AdminBadge variant={item.role === 'admin' ? 'confirmed' : 'pending'}>
          {item.role === 'admin'
            ? (tAdmin('settings.invitations.roleAdmin') ?? 'Admin')
            : (tAdmin('settings.invitations.roleProfessional') ?? 'Professional')}
        </AdminBadge>
      ),
    },
    {
      key: 'status',
      label: tAdmin('settings.invitations.columnStatus') ?? 'Status',
      render: (item: InvitationRow) => {
        const variant = item.status === 'pending' ? 'pending'
          : item.status === 'expired' ? 'inactive'
          : 'confirmed';
        const label = item.status === 'pending'
          ? (tAdmin('settings.invitations.statusPending') ?? 'Pending')
          : item.status === 'expired'
          ? (tAdmin('settings.invitations.statusExpired') ?? 'Expired')
          : (tAdmin('settings.invitations.statusAccepted') ?? 'Accepted');
        return <AdminBadge variant={variant}>{label}</AdminBadge>;
      },
    },
    {
      key: 'created_at',
      label: tAdmin('settings.invitations.columnSent') ?? 'Sent',
      render: (item: InvitationRow) => (
        <span className="text-muted-foreground text-xs">
          {formatDateTime(new Date(item.created_at), lang)}
        </span>
      ),
    },
    {
      key: 'expires_at',
      label: tAdmin('settings.invitations.columnExpires') ?? 'Expires',
      render: (item: InvitationRow) => (
        <span className="text-muted-foreground text-xs">
          {formatDateTime(new Date(item.expires_at), lang)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: InvitationRow) =>
        item.status === 'pending' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRevoke(item.id)}
            disabled={revokingId === item.id}
          >
            {revokingId === item.id
              ? (tAdmin('settings.invitations.revoking') ?? 'Revoking...')
              : (tAdmin('settings.invitations.revoke') ?? 'Revoke')}
          </Button>
        ) : null,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
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

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="font-playfair text-lg text-foreground">
              {tAdmin('settings.invitations.title') ?? 'Invite Users'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {tAdmin('settings.invitations.subtitle') ?? 'Send an invitation to a new team member.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email" className="text-xs">
                {tAdmin('settings.invitations.fieldEmail') ?? 'Email Address'}
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tAdmin('settings.invitations.fieldEmailPlaceholder') ?? 'colleague@example.com'}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                {tAdmin('settings.invitations.fieldRole') ?? 'Role'}
              </Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="professional"
                    checked={role === 'professional'}
                    onChange={() => setRole('professional')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>{tAdmin('settings.invitations.roleProfessional') ?? 'Professional'}</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={role === 'admin'}
                    onChange={() => setRole('admin')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>{tAdmin('settings.invitations.roleAdmin') ?? 'Admin'}</span>
                </label>
              </div>
            </div>

            <Button type="submit" disabled={submitting || !email.trim()}>
              {submitting
                ? (tAdmin('settings.invitations.sending') ?? 'Sending...')
                : (tAdmin('settings.invitations.send') ?? 'Send Invitation')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="font-playfair text-lg text-foreground mb-4">
            {tAdmin('settings.invitations.tableTitle') ?? 'Pending Invitations'}
          </h3>
          <DataTable
            columns={columns as never}
            data={invitations as unknown as Record<string, unknown>[]}
            keyExtractor={(item) => String(item.id)}
            emptyMessage={tAdmin('settings.invitations.noInvitations') ?? 'No invitations yet'}
          />
        </CardContent>
      </Card>
    </div>
  );
}