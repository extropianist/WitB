import { useState } from "react";
import { Link } from "wouter";
import AppHeader from "@/components/layout/AppHeader";
import ItemCard from "@/components/items/ItemCard";
import AddItemModal from "@/components/items/AddItemModal";
import PhotoGalleryModal from "@/components/items/PhotoGalleryModal";
import QRCodeModal from "@/components/qr/QRCodeModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBox } from "@/hooks/use-boxes";
import { useRoom } from "@/hooks/use-rooms";
import { useItems } from "@/hooks/use-items";
import { ArrowLeft, QrCode, RefreshCw } from "lucide-react";
import type { ItemWithPhotos } from "@shared/schema";

interface BoxDetailProps {
  params: { roomId: string; boxId: string };
}

export default function BoxDetail({ params }: BoxDetailProps) {
  const { roomId, boxId } = params;
  const [selectedItem, setSelectedItem] = useState<ItemWithPhotos | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  const { room, isLoading: roomLoading } = useRoom(roomId);
  const { box, isLoading: boxLoading } = useBox(boxId);
  const { items, isLoading: itemsLoading } = useItems(boxId);

  const handleViewPhotos = (item: ItemWithPhotos) => {
    setSelectedItem(item);
    setShowPhotos(true);
  };

  const handleAddPhotos = (item: ItemWithPhotos) => {
    // TODO: Implement Google Picker integration
    console.log("Add photos for item:", item.id);
  };

  if (roomLoading || boxLoading) {
    return (
      <>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </main>
      </>
    );
  }

  if (!room || !box) {
    return (
      <>
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-foreground mb-2">Box not found</h2>
            <p className="text-muted-foreground mb-4">
              The box you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link href={`/room/${roomId}`}>
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Room
              </Button>
            </Link>
          </div>
        </main>
      </>
    );
  }

  const breadcrumbs = [
    { label: room.name, href: `/room/${roomId}` },
    { label: box.label }
  ];

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Link href={`/room/${roomId}`}>
                <Button variant="ghost" size="sm" data-testid="button-back-to-room">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-semibold text-foreground" data-testid={`text-box-name-${boxId}`}>
                  {box.label}
                </h2>
                <p className="text-muted-foreground">Items in this box</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQR(true)}
                className="bg-muted hover:bg-muted/80"
                data-testid={`button-show-qr-${boxId}`}
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowQR(true)}
                data-testid={`button-update-qr-${boxId}`}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Update QR
              </Button>
              <AddItemModal boxId={boxId} />
            </div>
          </div>

          {itemsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-cube text-muted-foreground text-2xl"></i>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No items yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first item to this box
              </p>
              <AddItemModal boxId={boxId} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-items">
              {items.map((item) => (
                <ItemCard 
                  key={item.id} 
                  item={item}
                  onViewPhotos={handleViewPhotos}
                  onAddPhotos={handleAddPhotos}
                />
              ))}
            </div>
          )}
        </div>

        {/* Photo Gallery Modal */}
        <PhotoGalleryModal
          item={selectedItem}
          open={showPhotos}
          onOpenChange={setShowPhotos}
          onAddPhotos={handleAddPhotos}
        />

        {/* QR Code Modal */}
        <QRCodeModal
          box={box}
          open={showQR}
          onOpenChange={setShowQR}
        />
      </main>
    </>
  );
}
