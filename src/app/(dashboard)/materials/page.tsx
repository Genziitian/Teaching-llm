import { redirect } from 'next/navigation'

// The Study Materials hub page was removed. Old links land on Recordings.
export default function MaterialsIndex() {
  redirect('/materials/recordings')
}
