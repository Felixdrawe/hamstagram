'use client';

import { useUser } from '@clerk/nextjs';
import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarImage } from './ui/avatar';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { SendHorizonal, ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { createPost } from '@/actions/post.action';

export default function CreatePost() {
  const { user } = useUser(); // Holt Clerk-User-Info aus dem Client-Kontext

  const [content, setContent] = useState(''); // Zustand für den Textinhalt
  const [imageUrl, setImageUrl] = useState(''); // Zustand für ein optionales Bild
  const [isPosting, setIsPosting] = useState(false); // Wird auf true gesetzt während der Erstellung
  const [showImageUpload, setShowImageUpload] = useState(false); // Zeigt optional Upload-Komponente

  // Diese Funktion wird beim Klick auf "Post" ausgeführt
  const handleSubmit = async () => {
    // Wenn weder Text noch Bild vorhanden → abbrechen
    if (!content.trim() && !imageUrl) return;

    setIsPosting(true); // Ladezustand aktivieren

    try {
      // Server Action aufrufen: Speichert den Post in der Datenbank
      const result = await createPost(content, imageUrl);
     

      // Wenn der Server-Call erfolgreich war → Eingaben zurücksetzen
      if (result?.success) {
        setContent('');
        setImageUrl('');
        setShowImageUpload(false);
        toast.success('Post created successfully'); // Erfolgsmeldung anzeigen
      }
    } catch {
      toast.error('Failed to create post'); // Fehler-Toaster
    } finally {
      setIsPosting(false); // Ladezustand beenden
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Avatar>
            <AvatarImage src={user?.imageUrl} />
          </Avatar>
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPosting}
          />
        </div>

        {/* TODO: Handle Image Upload */}

        <div className="mt-4 flex justify-between items-center">
          <Button
            type="button"
            onClick={() => setShowImageUpload(!showImageUpload)}
            variant="ghost"
            size="sm">
            <ImageIcon className="mr-2 h-4 w-4" />
            Photo
          </Button>

          <Button onClick={handleSubmit} disabled={(!content && !imageUrl) || isPosting} size="sm">
            {isPosting ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <>
                <SendHorizonal className="mr-2 h-4 w-4" />
                Post
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
