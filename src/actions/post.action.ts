// src/actions/post.action.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getDbUserId } from './user.action';
import { revalidatePath } from 'next/cache';

export async function createPost(content: string, image: string) {
  try {
    const userId = await getDbUserId();

    if (!userId) return;

    const post = await prisma.post.create({
      data: {
        content,
        image,
        authorId: userId,
      },
    });

    revalidatePath('/'); // purge the cache for the home page
    return { success: true, post };
  } catch (error) {
    console.error('Failed to create post:', error);
    return { success: false, error: 'Failed to create post' };
  }
}

// actions/post.action.ts
export async function getPosts() {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, image: true, username: true },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, image: true, username: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        likes: {
          select: { userId: true },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    return posts;
  } catch (error) {
    console.error('[GET_POSTS_ERROR]', error);
    throw new Error('Failed to fetch posts');
  }
}

// actions/post.action.ts
/**
 * Toggle like for a post. If the user already liked the post, it will unlike; otherwise, it will like.
 * IMPORTANT: This function enforces that users CANNOT like their own posts (even if attempted via API).
 * The UI should also prevent this, but this backend check ensures data integrity and security.
 */
export async function toggleLike(postId: string) {
  try {
    const userId = await getDbUserId();
    if (!userId) return;

    // check if like exists
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) throw new Error('Post not found');

    // Prevent users from liking their own posts (backend enforcement)
    if (post.authorId === userId) {
      return { success: false, error: "You can't like your own post" };
    }

    if (existingLike) {
      // unlike
      await prisma.like.delete({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
    } else {
      // like and create notification
      await prisma.$transaction([
        prisma.like.create({
          data: {
            userId,
            postId,
          },
        }),
        prisma.notification.create({
          data: {
            type: 'LIKE',
            userId: post.authorId, // recipient (post author)
            creatorId: userId, // person who liked
            postId,
          },
        }),
      ]);
    }

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to toggle like:', error);
    return { success: false, error: 'Failed to toggle like' };
  }
}

export async function createComment(postId: string, content: string) {
  try {
    const userId = await getDbUserId();

    if (!userId) return;
    if (!content) throw new Error('Content is required');

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) throw new Error('Post not found');

    // Create comment and notification in a transaction
    const [comment] = await prisma.$transaction(async (tx) => {
      // Create comment first
      const newComment = await tx.comment.create({
        data: {
          content,
          authorId: userId,
          postId,
        },
      });

      // Create notification if commenting on someone else's post
      if (post.authorId !== userId) {
        await tx.notification.create({
          data: {
            type: 'COMMENT',
            userId: post.authorId,
            creatorId: userId,
            postId,
            commentId: newComment.id,
          },
        });
      }

      return [newComment];
    });

    revalidatePath(`/`);
    return { success: true, comment };
  } catch (error) {
    console.error('Failed to create comment:', error);
    return { success: false, error: 'Failed to create comment' };
  }
}

export async function deletePost(postId: string) {
  try {
    const userId = await getDbUserId();

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) throw new Error('Post not found');
    if (post.authorId !== userId) throw new Error('Unauthorized - no delete permission');

    await prisma.post.delete({
      where: { id: postId },
    });

    revalidatePath('/'); // purge the cache
    return { success: true };
  } catch (error) {
    console.error('Failed to delete post:', error);
    return { success: false, error: 'Failed to delete post' };
  }
}
