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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, LogOut, Settings, CreditCard, Shield, Menu, Home, Sparkles, Camera, Palette, Cpu, Activity } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'

export function Navbar() {
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Check if the session has been invalidated by the server
    if ((session as any)?.error === 'SessionInvalidated') {
      console.log('Session invalidated, signing out...')
      signOut({ callbackUrl: '/login?error=session-expired' })
    }
  }, [session])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' })
  }

  const navigationItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/dashboard/generate', label: 'Generate', icon: Sparkles },
    { href: '/dashboard/edit', label: 'Edit', icon: Palette },
    { href: '/dashboard/gallery', label: 'Gallery', icon: Camera },
    { href: '/dashboard/models', label: 'Models', icon: Cpu },
    { href: '/dashboard/training', label: 'Training', icon: Activity },
  ]

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
                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-2">
                  {navigationItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <Button variant="ghost" size="sm">
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                
                  {/* Admin access for admin users */}
                  {session.user.isAdmin && (
                    <Link href="/admin">
                      <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700">
                        <Shield className="h-4 w-4 mr-1" />
                        Admin
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Mobile Navigation - Single Hamburger Menu */}
                <div className="md:hidden">
                  <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="px-2">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-80">
                      <SheetHeader>
                        <SheetTitle>Menu</SheetTitle>
                      </SheetHeader>
                      
                      {/* User Profile Section at Top */}
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="text-lg font-semibold">
                              {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            {session.user?.name && (
                              <p className="font-semibold text-gray-900 truncate">{session.user.name}</p>
                            )}
                            {session.user?.email && (
                              <p className="text-sm text-gray-500 truncate">{session.user.email}</p>
                            )}
                            <p className="text-sm font-medium text-blue-600">
                              {session.user?.credits || 0} credits
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Navigation Items */}
                      <div className="mt-6 space-y-1">
                        <div className="px-2 py-1">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Navigation
                          </h3>
                        </div>
                        {navigationItems.map((item) => {
                          const Icon = item.icon
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsOpen(false)}
                              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <Icon className="h-5 w-5 text-gray-500" />
                              <span className="font-medium">{item.label}</span>
                            </Link>
                          )
                        })}
                        
                        {/* Admin access for admin users */}
                        {session.user.isAdmin && (
                          <Link
                            href="/admin"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                          >
                            <Shield className="h-5 w-5 text-orange-600" />
                            <span className="font-medium text-orange-600">Admin</span>
                          </Link>
                        )}
                      </div>

                      {/* Account Management */}
                      <div className="mt-6 space-y-1">
                        <div className="px-2 py-1">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Account
                          </h3>
                        </div>
                        
                        <Link
                          href="/dashboard/billing"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <CreditCard className="h-5 w-5 text-gray-500" />
                          <span className="font-medium">Billing</span>
                        </Link>
                        
                        <Link
                          href="/dashboard/settings"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Settings className="h-5 w-5 text-gray-500" />
                          <span className="font-medium">Settings</span>
                        </Link>
                        
                        <button
                          onClick={() => {
                            setIsOpen(false)
                            handleSignOut()
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left"
                        >
                          <LogOut className="h-5 w-5 text-gray-500" />
                          <span className="font-medium">Log out</span>
                        </button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                
                {/* Desktop-Only User Avatar Dropdown */}
                <div className="hidden md:block">
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
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 