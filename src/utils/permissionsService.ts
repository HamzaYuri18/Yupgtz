import { supabase } from '../lib/supabase';

export interface UserPermissions {
  home: boolean;
  contract: boolean;
  reports: boolean;
  statistics: boolean;
  credits: boolean;
  financial: boolean;
  payment: boolean;
  terme: boolean;
  transactions: boolean;
  encaissement: boolean;
  reporting: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  home: true,
  contract: true,
  reports: true,
  statistics: true,
  credits: true,
  financial: true,
  payment: true,
  terme: true,
  transactions: true,
  encaissement: true,
  reporting: true,
};

export const TAB_LABELS: Record<keyof UserPermissions, string> = {
  home: 'Accueil',
  contract: 'Nouveau Contrat',
  reports: 'Rapports',
  statistics: 'Statistiques',
  credits: 'Liste des Credits',
  financial: 'Gestion Financiere',
  payment: 'Paiement Credit',
  terme: 'Terme',
  transactions: 'Rapport Transactions',
  encaissement: 'Encaissement',
  reporting: 'Reporting',
};

export async function getUserPermissions(username: string): Promise<UserPermissions> {
  if (username.toLowerCase() === 'hamza') {
    return { ...DEFAULT_PERMISSIONS };
  }

  const { data, error } = await supabase
    .from('user_permissions')
    .select('permissions')
    .eq('username', username)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_PERMISSIONS };
  }

  return { ...DEFAULT_PERMISSIONS, ...data.permissions } as UserPermissions;
}

export async function saveUserPermissions(
  username: string,
  permissions: UserPermissions,
  updatedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_permissions')
    .upsert(
      { username, permissions, updated_by: updatedBy, updated_at: new Date().toISOString() },
      { onConflict: 'username' }
    );

  return !error;
}

export async function getAllUsersPermissions(): Promise<Record<string, UserPermissions>> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('username, permissions');

  if (error || !data) return {};

  const result: Record<string, UserPermissions> = {};
  for (const row of data) {
    result[row.username] = { ...DEFAULT_PERMISSIONS, ...row.permissions } as UserPermissions;
  }
  return result;
}
