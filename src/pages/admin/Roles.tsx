import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Role, AVAILABLE_PERMISSIONS } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, Edit2, Trash2, Shield, Search, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

export default function Roles() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: '', permissions: [] as string[] });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'roles'));
      const rolesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Role[];
      setRoles(rolesData);
    } catch (error) {
      console.error("Erro ao buscar perfis:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({ name: role.name, permissions: role.permissions });
    } else {
      setEditingRole(null);
      setFormData({ name: '', permissions: [] });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRole(null);
    setFormData({ name: '', permissions: [] });
  };

  const handleTogglePermission = (permissionId: string) => {
    setFormData(prev => {
      const hasPerm = prev.permissions.includes(permissionId);
      if (hasPerm) {
        return { ...prev, permissions: prev.permissions.filter(p => p !== permissionId) };
      } else {
        return { ...prev, permissions: [...prev.permissions, permissionId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole && editingRole.id) {
        // Update
        const roleRef = doc(db, 'roles', editingRole.id);
        await updateDoc(roleRef, {
          name: formData.name,
          permissions: formData.permissions
        });
      } else {
        // Create
        await addDoc(collection(db, 'roles'), {
          name: formData.name,
          permissions: formData.permissions,
          createdAt: Date.now()
        });
      }
      handleCloseModal();
      fetchRoles();
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
    }
  };

   const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'roles', id));
      fetchRoles();
    } catch (error) {
      console.error("Erro ao excluir perfil:", error);
    }
  };

  if (loading) return <div className={`p-8 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('common.loading')}</div>;

  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`space-y-6 transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.roles')}</h1>
          <p className="text-sm text-slate-500">{t('admin.rolesSub')}</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          {t('admin.createRole')}
        </button>
      </div>

      {/* Filtros */}
      <div className={`p-4 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('admin.rolesSearch')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none transition-all border ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-300'
            }`}
          />
        </div>
      </div>

      {/* Tabela de Perfis */}
      <div className={`rounded-xl border overflow-hidden transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('admin.roleName')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('admin.permissions')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredRoles.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-slate-500">
                  {t('admin.noRoles')}
                </td>
              </tr>
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Shield className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                      <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{role.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map(perm => (
                        <span key={perm} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          theme === 'dark' 
                            ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' 
                            : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {AVAILABLE_PERMISSIONS.find(p => p.id === perm)?.label || perm}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(role)}
                      className="text-blue-500 hover:text-blue-400 mr-4 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => role.id && setRoleToDelete(role.id)}
                      className="text-red-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Criação/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-xl max-w-md w-full p-6 my-auto ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {editingRole ? t('common.edit') : t('admin.createRole')}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('admin.roleName')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  placeholder="Ex: Líder de Vendas"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('admin.permissions')}
                </label>
                <div className={`space-y-2 max-h-60 overflow-y-auto p-2 border rounded-md ${
                  theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <label key={perm.id} className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.id)}
                        onChange={() => handleTogglePermission(perm.id)}
                        className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'}`}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                    theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!roleToDelete}
        title="Excluir Perfil"
        message={t('admin.rolesDeleteConfirm')}
        onConfirm={() => roleToDelete && handleDelete(roleToDelete)}
        onCancel={() => setRoleToDelete(null)}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
