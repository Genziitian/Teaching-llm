/**
 * Course Color Utilities
 * 
 * Handles both hex colors (#4F46E5) and CSS gradient strings
 * (linear-gradient(135deg, #667eea, #764ba2)).
 */

/** Check whether a color string is a gradient (vs a plain hex/named color). */
export function isGradient(color: string): boolean {
  if (!color || typeof color !== 'string') return false
  return color.includes('gradient')
}

/**
 * Extract the dominant (first) hex color from a color value.
 * Works with both plain hex strings and gradient strings.
 */
export function extractHex(color: string): string {
  if (!color || typeof color !== 'string') return '#4F46E5'
  const match = color.match(/#[0-9a-fA-F]{6}/)
  return match ? match[0] : '#4F46E5' // fallback indigo
}

/**
 * Determine whether a hex color is "light" using relative luminance.
 * Returns true if luminance > 0.5 (i.e. text should be dark).
 */
export function isLightColor(color: string): boolean {
  const hex = extractHex(color)
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  // sRGB → linear
  const lr = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const lg = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const lb = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)

  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  return luminance > 0.45
}

/**
 * Get the CSS `background` value for a course color.
 * - Gradients are used as-is.
 * - Hex colors get wrapped in a subtle gradient.
 */
export function getCourseBackground(color: string): string {
  if (isGradient(color)) return color
  return `linear-gradient(135deg, ${color}, ${color}cc)`
}

/**
 * Get appropriate text color (white or dark) based on the course color.
 */
export function getCourseTextColor(color: string): string {
  return isLightColor(color) ? '#1e1e3a' : '#ffffff'
}

/**
 * Get a muted/secondary text color based on the course color.
 */
export function getCourseSecondaryTextColor(color: string): string {
  return isLightColor(color) ? 'rgba(30,30,58,0.65)' : 'rgba(255,255,255,0.75)'
}

/**
 * Get a subtle overlay color for badges/tags on the course banner.
 */
export function getCourseBadgeBg(color: string): string {
  return isLightColor(color) ? 'rgba(30,30,58,0.12)' : 'rgba(255,255,255,0.15)'
}

/**
 * Get badge text color on the course banner.
 */
export function getCourseBadgeText(color: string): string {
  return isLightColor(color) ? '#1e1e3a' : '#ffffff'
}

/**
 * Get decorative circle color for the banner.
 */
export function getCourseDecorativeColor(color: string): string {
  return isLightColor(color) ? 'rgba(30,30,58,0.06)' : 'rgba(255,255,255,0.08)'
}

/**
 * Safely append a hex opacity suffix to a color.
 * For gradients, extracts the first hex color and uses that.
 */
export function colorWithOpacity(color: string, opacitySuffix: string): string {
  const hex = extractHex(color)
  return `${hex}${opacitySuffix}`
}

type ResolvedTheme = 'light' | 'dark' | 'black'

export interface CourseDisplayPalette {
  isRefinedLightPalette: boolean
  accent: string
  hoverAccent: string
  softBg: string
  softerBg: string
  softBorder: string
  shadow: string
  background: string
  textColor: string
  secondaryText: string
  badgeBg: string
  badgeText: string
  decorativeColor: string
}

function getRgb(color: string) {
  const hex = extractHex(color).replace('#', '')
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

function getHueSaturationLightness(color: string) {
  const { r, g, b } = getRgb(color)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const lightness = (max + min) / 2
  const delta = max - min

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness }
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === rn) hue = 60 * (((gn - bn) / delta) % 6)
  else if (max === gn) hue = 60 * ((bn - rn) / delta + 2)
  else hue = 60 * ((rn - gn) / delta + 4)
  if (hue < 0) hue += 360

  return { hue, saturation, lightness }
}

function isBrightProGreen(color: string) {
  const { hue, saturation, lightness } = getHueSaturationLightness(color)
  const { g, r, b } = getRgb(color)
  return hue >= 130 && hue <= 175 && saturation >= 0.45 && lightness >= 0.42 && g > r && g > b
}

export function getCourseDisplayPalette(color: string, resolvedTheme: ResolvedTheme = 'light'): CourseDisplayPalette {
  if (resolvedTheme === 'light' && isBrightProGreen(color)) {
    return {
      isRefinedLightPalette: true,
      accent: '#0F7A4B',
      hoverAccent: '#0D6B43',
      softBg: 'rgba(15, 122, 75, 0.10)',
      softerBg: 'rgba(15, 122, 75, 0.07)',
      softBorder: 'rgba(15, 122, 75, 0.22)',
      shadow: 'rgba(15, 122, 75, 0.22)',
      background: 'linear-gradient(135deg, #24C76D 0%, #20BFA4 100%)',
      textColor: '#1e1e3a',
      secondaryText: 'rgba(30,30,58,0.68)',
      badgeBg: 'rgba(15, 122, 75, 0.12)',
      badgeText: '#0F5F3D',
      decorativeColor: 'rgba(255,255,255,0.14)',
    }
  }

  const accent = extractHex(color)
  return {
    isRefinedLightPalette: false,
    accent,
    hoverAccent: `${accent}dd`,
    softBg: colorWithOpacity(color, '12'),
    softerBg: colorWithOpacity(color, '10'),
    softBorder: colorWithOpacity(color, '24'),
    shadow: colorWithOpacity(color, '35'),
    background: getCourseBackground(color),
    textColor: getCourseTextColor(color),
    secondaryText: getCourseSecondaryTextColor(color),
    badgeBg: getCourseBadgeBg(color),
    badgeText: getCourseBadgeText(color),
    decorativeColor: getCourseDecorativeColor(color),
  }
}

// ─── Color palette for the manage page color picker ──────────────────────────

export const SOLID_COLORS = [
  '#4F46E5', // Indigo
  '#7C3AED', // Violet
  '#6366F1', // Purple
  '#3B82F6', // Blue
  '#0EA5E9', // Sky
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#F97316', // Orange
  '#EF4444', // Red
  '#EC4899', // Pink
]

export const GRADIENT_COLORS = [
  'linear-gradient(135deg, #667eea, #764ba2)', // Cosmic Purple
  'linear-gradient(135deg, #f093fb, #f5576c)', // Pink Sunset
  'linear-gradient(135deg, #4facfe, #00f2fe)', // Ocean Breeze
  'linear-gradient(135deg, #43e97b, #38f9d7)', // Emerald Glow
  'linear-gradient(135deg, #fa709a, #fee140)', // Peach Gold
  'linear-gradient(135deg, #a18cd1, #fbc2eb)', // Lavender Dream
  'linear-gradient(135deg, #ff6a00, #ee0979)', // Fire Rush
  'linear-gradient(135deg, #1e3a5f, #4a90d9)', // Deep Ocean
]
