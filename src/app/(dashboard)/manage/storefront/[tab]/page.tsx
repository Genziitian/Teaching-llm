'use client'
import { useParams } from 'next/navigation'
import StorefrontPanelFrame from '@/components/storefront/StorefrontPanelFrame'
export default function StorefrontPanelTabPage() {
  const params = useParams<{ tab: string }>()
  return <StorefrontPanelFrame tab={params.tab} embed />
}
