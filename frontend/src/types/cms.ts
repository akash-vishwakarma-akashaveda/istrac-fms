export interface CmsBlock {
  blockKey: string
  content: Record<string, unknown>
}

export interface HeroSlide {
  url: string
  caption?: string
  alt?: string
  nodeHeadline?: string // e.g. "IDSN BYALALU DEEP SPACE NODE"
  stationText?: string  // e.g. "STATION: ISTRAC BENGALURU MOX COMPLEX"
  carrierText?: string  // e.g. "CARRIER: NOMINAL LOCK"
  fallbackTitle?: string
  fallbackSubtitle?: string
}

export interface HeroContent {
  title: string
  subtitle: string
  ctaText: string
  badgeText?: string
  cardHeadline?: string
  stationText?: string
  carrierText?: string
  fallbackTitle?: string
  fallbackSubtitle?: string
  imageUrl?: string
  imageAlt?: string
  slides?: HeroSlide[]
}

export interface AnnouncementContent {
  visible: boolean
  text: string
  backgroundColor?: string // e.g. "orange" | "red" | "navy" — admin-selectable
}