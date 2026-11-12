export function slugifyCourseName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCheckoutPath(course: { id: string; name: string }) {
  const slug = slugifyCourseName(course.name) || String(course.id);
  const params = new URLSearchParams({ courseId: String(course.id) });
  return `/checkout/${slug}?${params.toString()}`;
}
