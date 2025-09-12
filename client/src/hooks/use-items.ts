import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ItemWithPhotos, Item, InsertItem } from "@shared/schema";

export function useItems(boxId: string) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<ItemWithPhotos[]>({
    queryKey: ["/api/boxes", boxId, "items"],
    enabled: !!boxId,
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: InsertItem) => {
      const res = await apiRequest("POST", `/api/boxes/${boxId}/items`, itemData);
      return res.json() as Promise<Item>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boxes", boxId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
  });

  return {
    items,
    isLoading,
    createItem: createItemMutation.mutate,
    isCreatingItem: createItemMutation.isPending,
  };
}
