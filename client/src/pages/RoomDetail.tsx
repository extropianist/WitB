import { useState } from "react";
import { Link } from "wouter";
import AppHeader from "@/components/layout/AppHeader";
import BoxCard from "@/components/boxes/BoxCard";
import CreateBoxModal from "@/components/boxes/CreateBoxModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoom } from "@/hooks/use-rooms";
import { useBoxes } from "@/hooks/use-boxes";
import { ArrowLeft, Download, FileText, Search } from "lucide-react";

interface RoomDetailProps {
  params: { roomId: string };
}

export default function RoomDetail({ params }: RoomDetailProps) {
  const { roomId } = params;
  const [searchQuery, setSearchQuery] = useState("");
  
  const { room, isLoading: roomLoading } = useRoom(roomId);
  const { boxes, isLoading: boxesLoading } = useBoxes(roomId);

  const filteredBoxes = boxes.filter(box =>
    box.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (box.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleExportRoom = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/export-csv`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export room data');
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `room-export-${room?.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export room:', error);
      // TODO: Show toast notification for error
    }
  };

  if (roomLoading) {
    return (
      <>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </main>
      </>
    );
  }

  if (!room) {
    return (
      <>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-foreground mb-2">Room not found</h2>
            <p className="text-muted-foreground mb-4">
              The room you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Rooms
              </Button>
            </Link>
          </div>
        </main>
      </>
    );
  }

  const breadcrumbs = [{ label: room.name }];

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-back-to-rooms">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-semibold text-foreground" data-testid={`text-room-name-${roomId}`}>
                  {room.name}
                </h2>
                <p className="text-muted-foreground">Boxes in this room</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={handleExportRoom} data-testid="button-export-room">
                <Download className="mr-2 h-4 w-4" />
                Export Room
              </Button>
              <Button variant="outline" disabled data-testid="button-pull-sheets">
                <FileText className="mr-2 h-4 w-4" />
                Pull Sheets
              </Button>
              <CreateBoxModal roomId={roomId} />
            </div>
          </div>

          {/* Search and Filter */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search boxes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-boxes"
              />
            </div>
          </div>

          {boxesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredBoxes.length === 0 ? (
            <div className="text-center py-12">
              {searchQuery ? (
                <>
                  <h3 className="text-lg font-medium text-foreground mb-2">No boxes found</h3>
                  <p className="text-muted-foreground mb-4">
                    No boxes match your search criteria
                  </p>
                  <Button onClick={() => setSearchQuery("")} variant="outline">
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-box text-muted-foreground text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">No boxes yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first box to start organizing items
                  </p>
                  <CreateBoxModal roomId={roomId} />
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-boxes">
              {filteredBoxes.map((box) => (
                <BoxCard key={box.id} box={box} roomId={roomId} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
