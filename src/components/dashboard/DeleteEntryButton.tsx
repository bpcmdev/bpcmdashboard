import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logActivity, ActivityEntityType } from '@/lib/activityLog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useWeek } from '@/contexts/WeekContext';

interface DeleteEntryButtonProps {
  table: string;
  id: string;
  label?: string;
}

const TABLE_TO_ENTITY: Record<string, ActivityEntityType> = {
  placements: 'placement',
  key_wins: 'key_win',
  pipeline_moments: 'pipeline_moment',
  partnerships: 'partnership',
  product_pipeline: 'product_launch',
};

const DeleteEntryButton = ({ table, id, label = 'this entry' }: DeleteEntryButtonProps) => {
  const { refreshData } = useWeek();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.error(`[DeleteEntry] ${table} delete error:`, error);
    } else {
      console.log(`[DeleteEntry] deleted ${id} from ${table}`);
      const entityType = TABLE_TO_ENTITY[table];
      if (entityType) {
        logActivity({ action: 'deleted', entity_type: entityType, entity_id: id, entity_title: label });
      }
      refreshData();
    }
    setDeleting(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteEntryButton;
