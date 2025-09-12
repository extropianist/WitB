import { useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import RoomCard from "@/components/rooms/RoomCard";
import CreateRoomModal from "@/components/rooms/CreateRoomModal";
import InviteUserModal from "@/components/rooms/InviteUserModal";
import { useRooms } from "@/hooks/use-rooms";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { rooms, isLoading } = useRooms();

  const adminRooms = rooms.filter(room => room.userRole === "admin");

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">My Rooms</h2>
              <p className="text-muted-foreground mt-1">
                Organize your inventory across different locations
              </p>
            </div>
            
            <div className="flex items-center space-x-3 mt-4 sm:mt-0">
              <InviteUserModal rooms={adminRooms} />
              <CreateRoomModal />
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-boxes text-muted-foreground text-2xl"></i>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No rooms yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first room to start organizing your inventory
              </p>
              <CreateRoomModal />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-rooms">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
