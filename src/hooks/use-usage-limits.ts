'use client'

import { useState, useEffect, useCallback } from 'react'

interface UsageLimits {
  maxCreditsPerMonth: number
  maxModels: number
  currentCredits: number
  currentModels: number
  canCreateModel: boolean
  canGenerateImage: boolean
  warningThreshold: number
  isNearLimit: boolean
}

interface LowCreditNotification {
  shouldNotify: boolean
  message: string
  severity: 'warning' | 'critical'
  creditsRemaining: number
  suggestedAction: string
}

interface UsageLimitsState {
  limits: UsageLimits | null
  notification: LowCreditNotification | null
  loading: boolean
  error: string | null
}

export function useUsageLimits() {
  const [state, setState] = useState<UsageLimitsState>({
    limits: null,
    notification: null,
    loading: true,
    error: null
  })

  const fetchLimits = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const response = await fetch('/api/dashboard/usage-limits')
      if (!response.ok) {
        throw new Error('Failed to fetch usage limits')
      }
      
      const data = await response.json()
      setState({
        limits: data.data.limits,
        notification: data.data.notification,
        loading: false,
        error: null
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch usage limits'
      }))
    }
  }, [])

  useEffect(() => {
    fetchLimits()
  }, [fetchLimits])

  // Helper functions for checking permissions
  const canPerformAction = useCallback((action: 'generate' | 'createModel') => {
    if (!state.limits) return false
    
    switch (action) {
      case 'generate':
        return state.limits.canGenerateImage
      case 'createModel':
        return state.limits.canCreateModel
      default:
        return false
    }
  }, [state.limits])

  const getActionBlockedReason = useCallback((action: 'generate' | 'createModel') => {
    if (!state.limits) return 'Loading...'
    
    switch (action) {
      case 'generate':
        if (!state.limits.canGenerateImage) {
          return state.limits.currentCredits <= 0 
            ? 'No credits remaining. Purchase more credits or upgrade your plan.'
            : 'Image generation is not available on your current plan.'
        }
        return null
      case 'createModel':
        if (!state.limits.canCreateModel) {
          return state.limits.currentModels >= state.limits.maxModels
            ? `Model limit reached (${state.limits.maxModels}). Delete existing models or upgrade your plan.`
            : 'Model creation is not available on your current plan.'
        }
        return null
      default:
        return 'Unknown action'
    }
  }, [state.limits])

  const hasLowCredits = useCallback(() => {
    return state.notification?.shouldNotify && state.notification.severity === 'warning'
  }, [state.notification])

  const hasCriticalCredits = useCallback(() => {
    return state.notification?.shouldNotify && state.notification.severity === 'critical'
  }, [state.notification])

  const getCreditsRemaining = useCallback(() => {
    return state.limits?.currentCredits || 0
  }, [state.limits])

  const getModelsRemaining = useCallback(() => {
    if (!state.limits) return 0
    return Math.max(0, state.limits.maxModels - state.limits.currentModels)
  }, [state.limits])

  const refresh = useCallback(() => {
    fetchLimits()
  }, [fetchLimits])

  return {
    ...state,
    canPerformAction,
    getActionBlockedReason,
    hasLowCredits,
    hasCriticalCredits,
    getCreditsRemaining,
    getModelsRemaining,
    refresh
  }
} 