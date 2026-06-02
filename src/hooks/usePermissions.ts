import { useAuth } from '../contexts/AuthContext';

const ADMIN_EMAILS = [
  'cesar.bronzatto@xertica.com',
  'gustavo.paula@xertica.com',
  'kefreen.batista@xertica.com'
];

export function usePermissions() {
  const { permissions, userProfile, user, isAdminMode } = useAuth();

  const isHardcodedAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()) && isAdminMode);

  const hasPermission = (permission: string) => {
    // Hardcoded bypass to ensure admins never lose access due to firestore sync / rules issues
    if (isHardcodedAdmin) return true;
    
    if (permissions.includes(permission)) return true;
    
    return false;
  };

  const isManagementAdmin = isHardcodedAdmin || permissions.some(p => 
    ['view_analytics', 'manage_users', 'manage_roles', 'manage_learning'].includes(p)
  );

  return {
    hasPermission,
    isManagementAdmin,
    permissions: isHardcodedAdmin 
      ? ['view_admin', 'view_analytics', 'manage_users', 'manage_roles', 'manage_learning', 'view_team'] 
      : permissions,
    roleId: userProfile?.roleId
  };
}
