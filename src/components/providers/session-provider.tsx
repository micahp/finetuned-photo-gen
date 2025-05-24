'use client'

import { SessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  session: Session | null
}

export function AuthSessionProvider({ children, session }: Props) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  )
} 