export function formatDisplayName(displayName: string | null | undefined): string {
  if (!displayName) return 'Usuário';
  
  // Se for um email completo, pega a parte antes do @
  const namePart = displayName.includes('@') ? displayName.split('@')[0] : displayName;
  
  // Se não houver pontos ou espaços, apenas capitaliza a primeira letra
  if (!namePart.includes('.') && !namePart.includes(' ')) {
    return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
  }
  
  // Divide por pontos ou espaços e capitaliza cada parte
  return namePart
    .split(/[.\s]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
