export interface CmsBlock {
  blockKey: string
  content: Record<string, unknown>
}

export interface HeroSlide {
  url: string
  caption?: string
  alt?: string
}

export interface HeroContent {
  title: string
  subtitle: string
  ctaText: string
  badgeText?: string
  imageUrl?: string
  imageAlt?: string
  slides?: HeroSlide[]
}

export interface AnnouncementContent {
  visible: boolean
  text: string
  backgroundColor?: string // e.g. "orange" | "red" | "navy" — admin-selectable
}