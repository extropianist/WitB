import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { ItemWithPhotos } from "@shared/schema";

interface PhotoGalleryModalProps {
  item: ItemWithPhotos | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPhotos?: (item: ItemWithPhotos) => void;
}

export default function PhotoGalleryModal({ 
  item, 
  open, 
  onOpenChange, 
  onAddPhotos 
}: PhotoGalleryModalProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle data-testid={`text-gallery-title-${item.id}`}>
            {item.name} Photos
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {item.photos.map((photo, index) => (
            <div 
              key={photo.id} 
              className="aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              data-testid={`img-gallery-photo-${photo.id}`}
            >
              <img 
                src={photo.webViewLink || photo.thumbLink || ''} 
                alt={`${item.name} photo ${index + 1}`}
                className="w-full h-full object-cover" 
              />
            </div>
          ))}
          
          {/* Add Photo button for admins */}
          <div 
            className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary hover:text-primary transition-colors"
            onClick={() => onAddPhotos?.(item)}
            data-testid={`button-add-more-photos-${item.id}`}
          >
            <div className="text-center">
              <Plus className="h-6 w-6 mx-auto mb-2" />
              <div className="text-sm">Add Photo</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
