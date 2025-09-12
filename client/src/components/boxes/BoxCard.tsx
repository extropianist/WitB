import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Package } from "lucide-react";
import type { BoxWithStats } from "@shared/schema";

interface BoxCardProps {
  box: BoxWithStats;
  roomId: string;
}

export default function BoxCard({ box, roomId }: BoxCardProps) {
  const isEmpty = box.itemCount === 0;

  return (
    <Link href={`/room/${roomId}/box/${box.id}`} className="block">
      <Card className={`card-hover cursor-pointer ${isEmpty ? 'border-dashed' : ''}`} data-testid={`card-box-${box.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-medium text-foreground mb-1" data-testid={`text-box-label-${box.id}`}>
                {box.label}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid={`text-box-notes-${box.id}`}>
                {box.notes || "No notes"}
              </p>
            </div>
            <div className="w-8 h-8 bg-muted rounded flex items-center justify-center ml-2">
              <QrCode className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-muted-foreground flex items-center">
                <Package className="h-3 w-3 mr-1" />
                <span data-testid={`text-item-count-${box.id}`}>
                  {box.itemCount} items
                </span>
              </span>
              {isEmpty && (
                <Badge variant="secondary" className="text-xs">
                  Empty
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground" data-testid={`text-box-updated-${box.id}`}>
              {new Date(box.createdAt!).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
