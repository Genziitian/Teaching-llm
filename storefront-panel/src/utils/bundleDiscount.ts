/** Resolve bundle discount mode/min from top-level course fields and legacy nested JSON. */
export function resolveBundleDiscountConfig(course: any, firstBundleCourse?: any): {
  mode: 'all' | 'any';
  minCourses: 1 | 2 | 3 | 5;
} {
  const nested = firstBundleCourse ?? (Array.isArray(course?.bundleCourses) ? course.bundleCourses[0] : null);
  const topMode = course?.bundleDiscountMode;
  const nestedMode = nested?._bundleDiscountMode;
  // Either source saying "any" wins — top-level DB default is "all", which used to mask nested saves
  const mode: 'all' | 'any' = topMode === 'any' || nestedMode === 'any' ? 'any' : 'all';

  const nestedMin = nested?._bundleDiscountMinCourses;
  const topMin = course?.bundleDiscountMinCourses;
  // Prefer nested min when only nested stored "any" (legacy); otherwise top-level
  const rawMin = Number(
    nestedMode === 'any' && nestedMin != null
      ? nestedMin
      : (topMin ?? nestedMin ?? 3)
  );
  const minCourses = ([1, 2, 3, 5].includes(rawMin) ? rawMin : 3) as 1 | 2 | 3 | 5;
  return { mode, minCourses };
}
