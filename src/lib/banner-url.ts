/** New banner uploads save a 1600px copy (`-lg`) and a 640px copy (`-sm`) for cards. Older banners have no small copy. */
export const bannerThumb = (url: string) => (url.includes('-lg.') ? url.replace('-lg.', '-sm.') : url)
