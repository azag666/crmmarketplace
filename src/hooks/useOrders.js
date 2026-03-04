import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// Hook para buscar pedidos com filtros
export function useOrders(userId, filters = {}) {
  return useQuery({
    queryKey: ['orders', userId, filters],
    queryFn: () => api.getOrders(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: false,
  });
}

// Hook para buscar resumo financeiro
export function useFinancialSummary(userId, filters = {}) {
  return useQuery({
    queryKey: ['financialSummary', userId, filters],
    queryFn: () => api.getFinancialSummary(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutos
    refetchOnWindowFocus: false,
  });
}

// Hook para análise de perdas (Detetive Financeiro)
export function useLossAnalysis(userId, filters = {}) {
  return useQuery({
    queryKey: ['lossAnalysis', userId, filters],
    queryFn: () => api.getLossAnalysis(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutos
    refetchOnWindowFocus: false,
  });
}

// Hook para dados de fluxo de caixa
export function useCashFlow(userId, filters = {}) {
  return useQuery({
    queryKey: ['cashFlow', userId, filters],
    queryFn: () => api.getCashFlowData(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: false,
  });
}

// Hook para importar pedidos
export function useImportOrders() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, orders }) => api.importOrders(userId, orders),
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries(['orders', variables.userId]);
      queryClient.invalidateQueries(['financialSummary', variables.userId]);
      queryClient.invalidateQueries(['lossAnalysis', variables.userId]);
      queryClient.invalidateQueries(['cashFlow', variables.userId]);
    },
    onError: (error) => {
      console.error('Erro ao importar pedidos:', error);
    },
  });
}

// Hook para limpar dados
export function useClearData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId) => api.clearUserData(userId),
    onSuccess: (_, userId) => {
      // Limpar todas as queries do usuário
      queryClient.removeQueries(['orders', userId]);
      queryClient.removeQueries(['financialSummary', userId]);
      queryClient.removeQueries(['lossAnalysis', userId]);
      queryClient.removeQueries(['cashFlow', userId]);
      queryClient.removeQueries(['products', userId]);
    },
    onError: (error) => {
      console.error('Erro ao limpar dados:', error);
    },
  });
}
