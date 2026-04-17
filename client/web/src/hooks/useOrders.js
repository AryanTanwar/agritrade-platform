import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '../api'

export function useOrders(params) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn:  () => orderApi.list(params).then(r => r.data),
  })
}

export function useOrder(id) {
  return useQuery({
    queryKey: ['order', id],
    queryFn:  () => orderApi.getById(id).then(r => r.data),
    enabled:  !!id,
  })
}

export function useOrderHistory(id) {
  return useQuery({
    queryKey: ['orderHistory', id],
    queryFn:  () => orderApi.history(id).then(r => r.data),
    enabled:  !!id,
  })
}

function useOrderMutation(mutationFn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['order', id] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['orderHistory', id] })
    },
  })
}

export const usePlaceOrder    = () => useMutation({ mutationFn: orderApi.place })
export const useConfirmOrder  = () => useOrderMutation((id) => orderApi.confirm(id))
export const useDeliverOrder  = () => useOrderMutation((id) => orderApi.deliver(id))
export const useCompleteOrder = () => useOrderMutation((id) => orderApi.complete(id))
export const useCancelOrder   = () => useOrderMutation(({ id, reason }) => orderApi.cancel(id, reason))
export const useDisputeOrder  = () => useOrderMutation(({ id, reason }) => orderApi.dispute(id, reason))
