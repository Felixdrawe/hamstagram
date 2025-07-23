'use client';

import { useTransition } from 'react';
import { Button } from './ui/button';
import { Loader2Icon } from 'lucide-react';
import toast from 'react-hot-toast';
import { toggleFollow } from '@/actions/user.action';

function FollowButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleFollow = () => {
    startTransition(async () => {
      try {
        await toggleFollow(userId);
        toast.success('User followed successfully');
      } catch (error) {
        toast.error(
          'Error following user: ' + (error instanceof Error ? error.message : 'Unknown error')
        );
      }
    });
  };

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleFollow}
      disabled={isPending}
      className="w-20">
      {isPending ? <Loader2Icon className="size-4 animate-spin" /> : 'Follow'}
    </Button>
  );
}

export default FollowButton;
