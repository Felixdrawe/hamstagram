'use server';

import { prisma } from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export async function syncUser() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) return;

    const existingUser = await prisma.user.findUnique({
      where: {
        clerkId: userId,
      },
    });

    if (existingUser) return existingUser;

    const dbUser = await prisma.user.create({
      data: {
        clerkId: userId,
        name: `${user.firstName || ''} ${user.lastName || ''}`,
        username: user.username ?? user.emailAddresses[0].emailAddress.split('@')[0],
        email: user.emailAddresses[0].emailAddress,
        image: user.imageUrl,
      },
    });

    return dbUser;
  } catch (error) {
    console.log('Error in syncUser', error);
  }
}

export async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({
    where: {
      clerkId,
    },
    include: {
      _count: {
        select: {
          following: true, // Users this user follows
          followers: true, // Users who follow this user
          posts: true,
        },
      },
    },
  });
}

export async function getDbUserId() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const user = await getUserByClerkId(clerkId);

  if (!user) throw new Error('User not found');

  return user.id;
}

export async function getRandomUsers() {
  try {
    const userId = await getDbUserId();

    if (!userId) return [];

    // get 3 random users exclude ourselves & users that we already follow
    const randomUsers = await prisma.user.findMany({
      where: {
        AND: [
          { NOT: { id: userId } }, // Exclude myself
          {
            // Exclude users where I am already following them
            // This means: NOT EXISTS a Follows record where followerId = me AND followingId = them
            NOT: {
              followers: {
                some: {
                  followerId: userId, // I am the follower
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
      take: 3,
    });

    return randomUsers;
  } catch (error) {
    console.log('Error fetching random users', error);
    return [];
  }
}

export async function toggleFollow(targetUserId: string) {
  try {
    const userId = await getDbUserId(); // 🔐 Hole aktuelle User-ID aus Session (Clerk)

    if (!userId) return;

    if (userId === targetUserId) throw new Error('You cannot follow yourself'); // 🚫 Verhindere, sich selbst zu folgen

    // 🔍 Prüfe, ob bereits ein Follow-Eintrag existiert (ob ich diesen Nutzer schon folge)
    const existingFollow = await prisma.follows.findUnique({
      // 👉 Prisma sucht anhand des zusammengesetzten Primärschlüssels,
      // der im Prisma-Schema so definiert ist:
      //
      //   @@id([followerId, followingId])
      //
      // Dadurch entsteht automatisch ein kombinierter Key mit dem Namen:
      //   followerId_followingId
      //
      // Das ist KEIN Feld im Modell, sondern eine Prisma-Konvention für zusammengesetzte IDs
      where: {
        followerId_followingId: {
          followerId: userId, // ich bin der, der folgt
          followingId: targetUserId, // das ist die Person, der ich folgen will
        },
      },
    });

    if (existingFollow) {
      // 🗑️ Wenn bereits ein Follow existiert → dann entfolge (Unfollow)
      await prisma.follows.delete({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: targetUserId,
          },
        },
      });
    } else {
      // ➕ Noch kein Follow vorhanden → Folge dieser Person
      // Wir machen das in einer TRANSACTION:
      // Beide Aktionen (Follow + Notification) sollen entweder beide erfolgreich sein – oder keine.
      await prisma.$transaction([
        // 📌 prisma.$transaction([...]) sorgt dafür, dass beide Aktionen nur
        // gemeinsam ausgeführt werden. Falls eine davon fehlschlägt,
        // wird auch die andere rückgängig gemacht (= Transaktion).
        prisma.follows.create({
          data: {
            followerId: userId, // ich bin der Follower
            followingId: targetUserId, // der andere ist der, dem gefolgt wird
          },
        }),

        prisma.notification.create({
          data: {
            type: 'FOLLOW', // 📢 Benachrichtigungstyp
            userId: targetUserId, // derjenige, der benachrichtigt wird (wird gefolgt)
            creatorId: userId, // derjenige, der folgt (der die Aktion ausgelöst hat)
          },
        }),
      ]);
    }

    // 🔄 Revalidate UI → Home Page neu laden (zeigt neue Follow-Zahlen etc.)
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.log('Error in toggleFollow', error);
    return { success: false, error: 'Error toggling follow' };
  }
}
