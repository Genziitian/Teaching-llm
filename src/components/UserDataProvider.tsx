'use client'

import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface UserDataContextType {
  userData: any
  notifications: any[]
  unreadCounts: any
  mutateNotifications: () => void
  mutateUnread: () => void
}

const UserDataContext = createContext<UserDataContextType>({
  userData: null,
  notifications: [],
  unreadCounts: null,
  mutateNotifications: () => {},
  mutateUnread: () => {},
})

export function useUserData() {
  return useContext(UserDataContext)
}

/**
 * Centralizes all user-scoped data fetching (auth/me, notifications, unread)
 * and the SSE connection into a SINGLE provider. This eliminates:
 *  - Duplicate /api/auth/me calls from Header + Sidebar
 *  - Duplicate SSE connections to /api/user/stream from Header + Sidebar
 *  - Duplicate /api/notifications + /api/unread calls
 *
 * Both Header and Sidebar now consume this context instead of fetching independently.
 */
export function UserDataProvider({ children }: { children: ReactNode }) {
  // Single /api/auth/me call for the whole app
  const { data: userData } = useSWR('/api/auth/me', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  })

  // Single /api/notifications call
  const { data: notificationsData, mutate: mutateNotifications } = useSWR('/api/notifications', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  })

  // Single /api/unread call
  const { data: unreadCounts, mutate: mutateUnread } = useSWR('/api/unread', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  })

  const mutateNotificationsRef = useRef(mutateNotifications)
  const mutateUnreadRef = useRef(mutateUnread)
  mutateNotificationsRef.current = mutateNotifications
  mutateUnreadRef.current = mutateUnread

  // Single SSE connection for real-time invalidation
  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null
    let active = true

    function connect() {
      if (!active) return

      try {
        es = new EventSource('/api/user/stream')

        es.addEventListener('invalidate', (e) => {
          try {
            const payload = JSON.parse(e.data)
            if (payload.target === 'all' || payload.target === 'notifications') {
              mutateNotificationsRef.current()
            }
            if (payload.target === 'all' || payload.target === 'unread') {
              mutateUnreadRef.current()
            }
          } catch (err) {}
        })

        es.addEventListener('call', () => window.dispatchEvent(new Event('support-call:check')))

        es.onerror = () => {
          es?.close()
          // Reconnect after 5 seconds
          if (active) {
            reconnectTimeout = setTimeout(connect, 5000)
          }
        }
      } catch (err) {
        // SSE not supported or connection failed — reconnect
        if (active) {
          reconnectTimeout = setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      active = false
      es?.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [])

  const notifications = Array.isArray(notificationsData) ? notificationsData : []

  const stableMutateNotifications = useCallback(() => {
    mutateNotificationsRef.current()
  }, [])

  const stableMutateUnread = useCallback(() => {
    mutateUnreadRef.current()
  }, [])

  return (
    <UserDataContext.Provider value={{
      userData,
      notifications,
      unreadCounts,
      mutateNotifications: stableMutateNotifications,
      mutateUnread: stableMutateUnread,
    }}>
      {children}
    </UserDataContext.Provider>
  )
}
