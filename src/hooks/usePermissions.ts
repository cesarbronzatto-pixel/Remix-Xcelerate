import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
  const { permissions, userProfile } = useAuth();

  const hasPermission = (permission: string) => {
    // Se for o primeiro usuário a logar, podemos dar permissão total provisoriamente
    // Em produção, o primeiro admin é setado via script ou Firebase Console.
    if (permissions.includes(permission)) return true;
    
    // Fallback de segurança: se não tem role, não tem permissão
    return false;
  };

  const isManagementAdmin = permissions.some(p => 
    ['view_analytics', 'manage_users', 'manage_roles', 'manage_learning'].includes(p)
  );

  return {
    hasPermission,
    isManagementAdmin,
    permissions,
    roleId: userProfile?.roleId
  };
}
