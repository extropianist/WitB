import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { RoomWithStats, Room, InsertRoom } from "@shared/schema";

export function useRooms() {
  const queryClient = useQueryClient();

  const { data: rooms = [], isLoading } = useQuery<RoomWithStats[]>({
    queryKey: ["/api/rooms"],
  });

  const createRoomMutation = useMutation({
    mutationFn: async (roomData: InsertRoom) => {
      const res = await apiRequest("POST", "/api/rooms", roomData);
      return res.json() as Promise<Room>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
  });

  return {
    rooms,
    isLoading,
    createRoom: createRoomMutation.mutate,
    isCreatingRoom: createRoomMutation.isPending,
  };
}

export function useRoom(roomId: string) {
  const { data: room, isLoading } = useQuery<Room>({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
  });

  return {
    room,
    isLoading,
  };
}
