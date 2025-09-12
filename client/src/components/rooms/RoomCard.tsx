import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Home, Building, Warehouse, Users } from "lucide-react";
import type { RoomWithStats } from "@shared/schema";

interface RoomCardProps {
  room: RoomWithStats;
}

export default function RoomCard({ room }: RoomCardProps) {
  const getIcon = () => {
    const name = room.name.toLowerCase();
    if (name.includes('home')) return Home;
    if (name.includes('office')) return Building;
    if (name.includes('warehouse')) return Warehouse;
    return Home;
  };

  const Icon = getIcon();
  const isAdmin = room.userRole === "admin";

  return (
    <Link href={`/room/${room.id}`} className="block">
      <Card className="card-hover cursor-pointer" data-testid={`card-room-${room.id}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground" data-testid={`text-room-name-${room.id}`}>
                  {room.name}
                </h3>
                <p className="text-sm text-muted-foreground" data-testid={`text-room-description-${room.id}`}>
                  {room.description || "No description"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                {isAdmin ? "Admin" : "Viewer"}
              </Badge>
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled>
                      Edit Room
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled className="text-destructive">
                      Delete Room
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-foreground" data-testid={`text-box-count-${room.id}`}>
                {room.boxCount}
              </div>
              <div className="text-xs text-muted-foreground">Boxes</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-foreground" data-testid={`text-item-count-${room.id}`}>
                {room.itemCount}
              </div>
              <div className="text-xs text-muted-foreground">Items</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid={`text-last-updated-${room.id}`}>
              Updated {new Date(room.createdAt!).toLocaleDateString()}
            </span>
            <div className="flex items-center space-x-2">
              <Users className="h-3 w-3" />
              <span data-testid={`text-member-count-${room.id}`}>
                {room.memberCount} members
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
