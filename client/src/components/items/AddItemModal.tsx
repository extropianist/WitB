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
import { insertItemSchema } from "@shared/schema";
import { useItems } from "@/hooks/use-items";
import { useToast } from "@/hooks/use-toast";
import { Plus, CloudUpload } from "lucide-react";
import type { InsertItem } from "@shared/schema";

interface AddItemModalProps {
  boxId: string;
}

export default function AddItemModal({ boxId }: AddItemModalProps) {
  const [open, setOpen] = useState(false);
  const { createItem, isCreatingItem } = useItems(boxId);
  const { toast } = useToast();

  const form = useForm<InsertItem>({
    resolver: zodResolver(insertItemSchema.omit({ boxId: true })),
    defaultValues: {
      name: "",
      description: "",
      quantity: 1,
    },
  });

  const onSubmit = (data: InsertItem) => {
    createItem({ ...data, boxId }, {
      onSuccess: () => {
        toast({
          title: "Item added",
          description: "Your item has been added successfully.",
        });
        setOpen(false);
        form.reset();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to add item. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handlePhotoUpload = () => {
    // TODO: Implement Google Picker API integration
    toast({
      title: "Photo upload",
      description: "Google Picker integration coming soon!",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-item">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter item name" 
                      data-testid="input-item-name"
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
                      placeholder="Describe this item"
                      rows={3}
                      data-testid="input-item-description"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      min="1"
                      data-testid="input-item-quantity"
                      {...field}
                      value={field.value || 1}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Photos</label>
              <Button 
                type="button"
                variant="outline"
                className="w-full h-20 border-dashed border-2 flex-col"
                onClick={handlePhotoUpload}
                data-testid="button-upload-photos"
              >
                <CloudUpload className="h-6 w-6 mb-2" />
                <div className="text-sm">Click to upload photos</div>
                <div className="text-xs text-muted-foreground">Via Google Drive</div>
              </Button>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel-item"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isCreatingItem}
                data-testid="button-submit-item"
              >
                {isCreatingItem ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
