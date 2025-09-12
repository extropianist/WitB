import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Eye, Plus } from "lucide-react";
import type { ItemWithPhotos } from "@shared/schema";

interface ItemCardProps {
  item: ItemWithPhotos;
  onViewPhotos?: (item: ItemWithPhotos) => void;
  onAddPhotos?: (item: ItemWithPhotos) => void;
}

export default function ItemCard({ item, onViewPhotos, onAddPhotos }: ItemCardProps) {
  const hasPhotos = item.photoCount > 0;
  const primaryPhoto = item.photos.find(p => p.driveFileId === item.primaryPhotoFileId) || item.photos[0];

  return (
    <Card className="overflow-hidden" data-testid={`card-item-${item.id}`}>
      <div className="aspect-w-16 aspect-h-9 bg-muted">
        {primaryPhoto ? (
          <img 
            src={primaryPhoto.webViewLink || primaryPhoto.thumbLink || ''} 
            alt={item.name}
            className="w-full h-48 object-cover"
            data-testid={`img-item-${item.id}`}
          />
        ) : (
          <div className="w-full h-48 bg-muted flex items-center justify-center">
            <div className="text-center">
              <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No photo</p>
            </div>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-foreground" data-testid={`text-item-name-${item.id}`}>
            {item.name}
          </h3>
          <Badge variant="secondary" className="text-xs ml-2" data-testid={`text-item-quantity-${item.id}`}>
            Qty: {item.quantity}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3" data-testid={`text-item-description-${item.id}`}>
          {item.description || "No description"}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground" data-testid={`text-photo-count-${item.id}`}>
              {item.photoCount} photos
            </span>
          </div>
          {hasPhotos ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onViewPhotos?.(item)}
              data-testid={`button-view-photos-${item.id}`}
            >
              <Eye className="h-3 w-3 mr-1" />
              View All
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onAddPhotos?.(item)}
              data-testid={`button-add-photos-${item.id}`}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Photos
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
