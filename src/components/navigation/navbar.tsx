'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, LogOut, Settings, CreditCard, Shield } from 'lucide-react'
import Image from 'next/image'

export function Navbar() {
  const { data: session, status } = useSession()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' })
  }

  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={session ? "/dashboard" : "/"} className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <Image src="/favicon-transparent.png" alt="Fine Photo Gen Logo" width={32} height={32} />
                <h1 className="text-xl font-bold text-gray-900">Fine Photo Gen</h1>
                <Badge 
                  variant="secondary" 
                  className="text-[9px] font-normal px-1 py-0 bg-gray-100 text-gray-500 border border-gray-200 rounded-sm"
                >
                  beta
                </Badge>
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {status === 'loading' ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : session ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
                <Link href="/dashboard/generate">
                  <Button variant="ghost">Generate</Button>
                </Link>
                <Link href="/dashboard/edit">
                  <Button variant="ghost">Edit</Button>
                </Link>
                <Link href="/dashboard/gallery">
                  <Button variant="ghost">Gallery</Button>
                </Link>
                <Link href="/dashboard/models">
                  <Button variant="ghost">Models</Button>
                </Link>
                <Link href="/dashboard/training">
                  <Button variant="ghost">Training</Button>
                </Link>
                
                {/* Admin access for admin users */}
                {session.user.isAdmin && (
                  <Link href="/admin">
                    <Button variant="ghost" className="text-orange-600 hover:text-orange-700">
                      <Shield className="h-4 w-4 mr-1" />
                      Admin
                    </Button>
                  </Link>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        {session.user?.name && (
                          <p className="font-medium">{session.user.name}</p>
                        )}
                        {session.user?.email && (
                          <p className="w-[200px] truncate text-sm text-muted-foreground">
                            {session.user.email}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Credits: {session.user?.credits || 0}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/billing">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="ghost">Login</Button>
                </Link>
                <Link href="/register">
                  <Button>Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 