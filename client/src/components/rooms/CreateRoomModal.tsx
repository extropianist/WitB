import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRoomSchema } from "@shared/schema";
import { useRooms } from "@/hooks/use-rooms";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import type { InsertRoom } from "@shared/schema";

export default function CreateRoomModal() {
  const [open, setOpen] = useState(false);
  const { createRoom, isCreatingRoom } = useRooms();
  const { toast } = useToast();

  const form = useForm<InsertRoom>({
    resolver: zodResolver(insertRoomSchema.omit({ createdBy: true })),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = (data: InsertRoom) => {
    createRoom(data, {
      onSuccess: () => {
        toast({
          title: "Room created",
          description: "Your room has been created successfully.",
        });
        setOpen(false);
        form.reset();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to create room. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-room">
          <Plus className="mr-2 h-4 w-4" />
          New Room
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Room</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter room name" 
                      data-testid="input-room-name"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe this room's purpose"
                      rows={3}
                      data-testid="input-room-description"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel-room"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isCreatingRoom}
                data-testid="button-submit-room"
              >
                {isCreatingRoom ? "Creating..." : "Create Room"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
