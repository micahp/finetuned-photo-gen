'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * This component checks for a 'refresh=true' query parameter.
 * If found, it triggers a client-side session update via next-auth's update()
 * function to fetch the latest user data from the server (e.g., new credits)
 * without requiring a page reload or logging the user out.
 */
export function SessionRefresher() {
  const { update } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get('refresh') === 'true') {
      // Use replace to remove the query param from the URL
      // so the refresh doesn't happen again on subsequent re-renders.
      router.replace(window.location.pathname, { scroll: false });
      update();
    }
  }, [searchParams, update, router]);

  return null; // This component renders nothing.
} 