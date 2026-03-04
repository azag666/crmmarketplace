import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// Hook para buscar produtos
export function useProducts(userId) {
  return useQuery({
    queryKey: ['products', userId],
    queryFn: () => api.getProducts(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutos
    refetchOnWindowFocus: false,
  });
}

// Hook para criar/atualizar produto
export function useUpsertProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, sku, name, cost, additionalData }) => 
      api.upsertProduct(userId, sku, name, cost, additionalData),
    onSuccess: (_, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries(['products', variables.userId]);
      queryClient.invalidateQueries(['financialSummary', variables.userId]);
    },
    onError: (error) => {
      console.error('Erro ao salvar produto:', error);
    },
  });
}

// Hook para atualizar custo do produto
export function useUpdateProductCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, sku, newCost, reason }) => 
      api.updateProductCost(userId, sku, newCost, reason),
    onSuccess: (_, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries(['products', variables.userId]);
      queryClient.invalidateQueries(['financialSummary', variables.userId]);
      queryClient.invalidateQueries(['orders', variables.userId]);
    },
    onError: (error) => {
      console.error('Erro ao atualizar custo:', error);
    },
  });
}
