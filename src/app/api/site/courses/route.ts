import { listStoreCourses } from '@/lib/site/store-courses'
import { publicJson, readError } from '../public-read'

/** Public course list for the website, built from the same Store data the app uses (active courses only). */
export async function GET() {
  try {
    return publicJson({ courses: await listStoreCourses({ onlyActive: true }) })
  } catch (err) {
    return readError('courses', err)
  }
}
