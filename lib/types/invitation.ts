export type InvitationToken = {
  id: string
  email: string
  role: 'admin' | 'professional'
  token: string
  invited_by: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export type InvitationStatus = 'pending' | 'expired' | 'accepted'