import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFullSession } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import MobileBottomNav from '@/components/layout/MobileBottomNav'
import UpdateOverlay from '@/components/UpdateOverlay'
import SupportFloatingButton from '@/components/ui/SupportFloatingButton'
import ProfileSetupBlocker from '@/components/ProfileSetupBlocker'
import IdentitySetupBlocker from '@/components/IdentitySetupBlocker'
import DynamicPromptBlocker from '@/components/DynamicPromptBlocker'
import UserJourneyTracker from '@/components/UserJourneyTracker'
import PushNotificationSetup from '@/components/PushNotificationSetup'
import { UserDataProvider } from '@/components/UserDataProvider'
import GlobalUploadProgressModal from '@/components/GlobalUploadProgressModal'


import { TourProvider } from '@/components/tour/TourContext'
import LoadingFactsHydrator from '@/components/LoadingFactsHydrator'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getFullSession()

  if (!session) {
    redirect('/login')
  }

  // Redirect terminated users — uses the combined query, no extra DB call
  if (session.isTerminated) {
    redirect('/terminated')
  }

  // Maintenance mode guard
  if (session.isMaintenanceMode) {
    redirect('/maintenance')
  }

  if (!session.isProfileComplete) {
    return <ProfileSetupBlocker user={session} />
  }

  if (!session.isIdentityUpdated) {
    return <IdentitySetupBlocker user={session} />
  }

  return (
    <UserDataProvider>
      <TourProvider>
        <div className="dashboard-layout">
          <Sidebar
            userRole={session.role}
            userName={session.name}
            userEmail={session.email}
          />
          <div className="dashboard-main-container">
            <Header userName={session.name} userRole={session.role} />
            <main className="dashboard-scroll-region">
              {children}
            </main>
            <SupportFloatingButton />
            <MobileBottomNav userRole={session.role} />
          </div>
          <LoadingFactsHydrator />
          <UpdateOverlay />
          <DynamicPromptBlocker />
          <UserJourneyTracker enableDetailedLogs={session.enableDetailedLogs} />
          <PushNotificationSetup />
          <GlobalUploadProgressModal />
        </div>
      </TourProvider>
    </UserDataProvider>
  )
}
