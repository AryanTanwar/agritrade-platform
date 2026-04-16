import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingApi } from '../api'

export function useListings(params) {
  return useQuery({
    queryKey: ['listings', params],
    queryFn:  () => listingApi.list(params).then(r => r.data),
  })
}

export function useListing(id) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn:  () => listingApi.getById(id).then(r => r.data),
    enabled:  !!id,
  })
}

export function useMyListings() {
  return useQuery({
    queryKey: ['myListings'],
    queryFn:  () => listingApi.myListings().then(r => r.data),
  })
}

export function useCreateListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: listingApi.create,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['myListings'] }),
  })
}

export function useUpdateListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => listingApi.update(id, data),
    onSuccess:  (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['listing', id] })
      qc.invalidateQueries({ queryKey: ['myListings'] })
    },
  })
}

export function useDeleteListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => listingApi.remove(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['listings'] })
      qc.invalidateQueries({ queryKey: ['myListings'] })
    },
  })
}
