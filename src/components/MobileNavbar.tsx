import { currentUser } from '@clerk/nextjs/server';
import { MobileNavbarSheet } from './MobileNavbarSheet';

async function MobileNavbar() {
  const user = await currentUser();

  // Generate profile path using same logic as desktop navbar
  const profilePath = `/profile/${
    user?.username ?? user?.emailAddresses[0].emailAddress.split('@')[0]
  }`;

  return <MobileNavbarSheet isSignedIn={user !== null} profilePath={profilePath} />;
}

export default MobileNavbar;
