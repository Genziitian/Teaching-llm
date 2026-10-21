import AppleSurface from '@/components/ui/AppleSurface'

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppleSurface />
      {children}
    </>
  )
}
