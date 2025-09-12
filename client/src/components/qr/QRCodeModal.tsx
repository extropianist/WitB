import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Download, RefreshCw } from "lucide-react";
import { useRegenerateQR } from "@/hooks/use-boxes";
import { useToast } from "@/hooks/use-toast";
import type { Box } from "@shared/schema";

interface QRCodeModalProps {
  box: Box | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QRCodeModal({ box, open, onOpenChange }: QRCodeModalProps) {
  const { regenerateQR, isRegenerating } = useRegenerateQR();
  const { toast } = useToast();

  if (!box) return null;

  const handleRegenerateQR = () => {
    regenerateQR(box.id, {
      onSuccess: () => {
        toast({
          title: "QR code regenerated",
          description: "A new QR code has been generated for this box.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to regenerate QR code. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handleDownload = () => {
    toast({
      title: "Download QR code",
      description: "QR code download functionality coming soon!",
    });
  };

  const qrUrl = `${window.location.origin}/box/${box.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Box QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <div className="w-48 h-48 bg-muted rounded-lg mx-auto flex items-center justify-center">
            {/* QR Code would be generated server-side and displayed here */}
            <div className="text-center">
              <QrCode className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">QR Code</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="font-medium text-foreground" data-testid={`text-qr-box-label-${box.id}`}>
              {box.label}
            </p>
            <p className="text-sm text-muted-foreground">Scan to access this box</p>
            <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded" data-testid={`text-qr-url-${box.id}`}>
              {qrUrl}
            </p>
          </div>
          
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleDownload}
              data-testid={`button-download-qr-${box.id}`}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button 
              className="flex-1"
              onClick={handleRegenerateQR}
              disabled={isRegenerating}
              data-testid={`button-regenerate-qr-${box.id}`}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
