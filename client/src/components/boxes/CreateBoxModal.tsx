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
import { insertBoxSchema } from "@shared/schema";
import { useBoxes } from "@/hooks/use-boxes";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import type { InsertBox } from "@shared/schema";

interface CreateBoxModalProps {
  roomId: string;
}

export default function CreateBoxModal({ roomId }: CreateBoxModalProps) {
  const [open, setOpen] = useState(false);
  const { createBox, isCreatingBox } = useBoxes(roomId);
  const { toast } = useToast();

  const form = useForm<InsertBox>({
    resolver: zodResolver(insertBoxSchema.omit({ roomId: true })),
    defaultValues: {
      label: "",
      notes: "",
    },
  });

  const onSubmit = (data: InsertBox) => {
    createBox({ ...data, roomId }, {
      onSuccess: () => {
        toast({
          title: "Box created",
          description: "Your box has been created successfully.",
        });
        setOpen(false);
        form.reset();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to create box. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-box">
          <Plus className="mr-2 h-4 w-4" />
          New Box
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Box</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Box Label</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter box label" 
                      data-testid="input-box-label"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the contents of this box"
                      rows={3}
                      data-testid="input-box-notes"
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
                data-testid="button-cancel-box"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isCreatingBox}
                data-testid="button-submit-box"
              >
                {isCreatingBox ? "Creating..." : "Create Box"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
