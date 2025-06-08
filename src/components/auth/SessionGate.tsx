'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect } from 'react';

/**
 * This component acts as a security gate for the user's session.
 * It runs on all pages and listens for a specific error flag (`SessionInvalidated`)
 * sent from the server. If this flag is detected, it means the user's
 * session has been revoked (e.g., due to a subscription cancellation),
 * and it will trigger a full, clean sign-out to prevent access to the
 * application and avoid redirect loops.
 */
export function SessionGate() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === "SessionInvalidated") {
      signOut(); // This performs a clean, full logout by clearing the session cookie.
    }
  }, [session]);

  return null; // This component does not render any visible UI.
} 