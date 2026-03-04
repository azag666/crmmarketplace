import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// Hook para buscar configurações do usuário
export function useUserSettings(userId) {
  return useQuery({
    queryKey: ['userSettings', userId],
    queryFn: () => api.getUserSettings(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30, // 30 minutos
    refetchOnWindowFocus: false,
  });
}

// Hook para atualizar configurações
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, settings }) => api.updateUserSettings(userId, settings),
    onSuccess: (_, variables) => {
      // Invalidar query de configurações
      queryClient.invalidateQueries(['userSettings', variables.userId]);
    },
    onError: (error) => {
      console.error('Erro ao atualizar configurações:', error);
    },
  });
}
