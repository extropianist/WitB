import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { BoxWithStats, Box, InsertBox } from "@shared/schema";

export function useBoxes(roomId: string) {
  const queryClient = useQueryClient();

  const { data: boxes = [], isLoading } = useQuery<BoxWithStats[]>({
    queryKey: ["/api/rooms", roomId, "boxes"],
    enabled: !!roomId,
  });

  const createBoxMutation = useMutation({
    mutationFn: async (boxData: InsertBox) => {
      const res = await apiRequest("POST", `/api/rooms/${roomId}/boxes`, boxData);
      return res.json() as Promise<Box>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomId, "boxes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
  });

  return {
    boxes,
    isLoading,
    createBox: createBoxMutation.mutate,
    isCreatingBox: createBoxMutation.isPending,
  };
}

export function useBox(boxId: string) {
  const { data: box, isLoading } = useQuery<Box>({
    queryKey: ["/api/boxes", boxId],
    enabled: !!boxId,
  });

  return {
    box,
    isLoading,
  };
}

export function useQRCodeImage(boxId: string | null) {
  return useQuery({
    queryKey: ["/api/boxes", boxId, "qr-image"],
    queryFn: async () => {
      if (!boxId) return null;
      const res = await apiRequest("GET", `/api/boxes/${boxId}/qr-image`);
      return res.json() as Promise<{ qrCodeUrl: string }>;
    },
    enabled: !!boxId,
  });
}

export function useRegenerateQR() {
  const queryClient = useQueryClient();

  const regenerateQRMutation = useMutation({
    mutationFn: async (boxId: string) => {
      const res = await apiRequest("POST", `/api/boxes/${boxId}/regenerate-qr`);
      return res.json() as Promise<{ qrCodeUrl: string }>;
    },
    onSuccess: (_, boxId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boxes", boxId] });
      queryClient.invalidateQueries({ queryKey: ["/api/boxes", boxId, "qr-image"] });
    },
  });

  return {
    regenerateQR: regenerateQRMutation.mutate,
    isRegenerating: regenerateQRMutation.isPending,
  };
}
