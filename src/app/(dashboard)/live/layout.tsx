import AppleSurface from '@/components/ui/AppleSurface'

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="apple-ui" style={{ display: 'contents' }}>
      <AppleSurface />
      {children}
    </div>
  )
}
