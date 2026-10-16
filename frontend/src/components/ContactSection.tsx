import { ArrowUpRight, Mail, Phone, MapPin, Headphones } from "lucide-react"
import { useCms, DEFAULT_CMS_BLOCKS } from "../context/cmsContext"
import { safeHref } from "../lib/sanitize"
import { SectionHeader } from "./SectionHeader"

interface ContactBlockContent {
  sectionEyebrow?: string
  sectionTitle?: string
  sectionSubtitle?: string
  email?: string
  phone?: string
  address?: string
  deskBadge?: string
  facilityName?: string
}

export function ContactSection() {
  const { cmsBlocks } = useCms()
  const info = cmsBlocks["info"] as Record<string, string> | undefined
  const contactInfo = cmsBlocks["contact_info"] as ContactBlockContent | undefined

  const sectionEyebrow = contactInfo?.sectionEyebrow || "Support & Helpdesk"
  const sectionTitle = contactInfo?.sectionTitle || "Need Help with ISTRAC-SIMS?"
  const sectionSubtitle =
    contactInfo?.sectionSubtitle ||
    "Reach the ground station support engineering team for departmental access authorization, satellite uplink feeds, and telemetry pipeline queries."

  const email =
    contactInfo?.email ||
    info?.contactEmail ||
    (DEFAULT_CMS_BLOCKS["info"].contactEmail as string) ||
    "support@istrac.isro.gov.in"

  const phone =
    contactInfo?.phone ||
    info?.contactPhone ||
    (DEFAULT_CMS_BLOCKS["info"].contactPhone as string) ||
    "+91 80 2838 4000"

  const address =
    contactInfo?.address ||
    info?.address ||
    (DEFAULT_CMS_BLOCKS["info"].address as string) ||
    "ISTRAC Campus, Plot No. 12 & 13, 3rd Main, 2nd Phase, Peenya Industrial Area, Bengaluru, Karnataka 560058"

  const deskBadge = contactInfo?.deskBadge || "● 24/7 MISSION DESK"
  const facilityName = contactInfo?.facilityName || "Ground Facility Headquarters"

  const cardClass =
    "group flex items-start gap-4 rounded-2xl border border-border-subtle bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover"

  return (
    <section id="contact" className="relative overflow-hidden bg-band-saffron py-24" aria-labelledby="contact-title">
      <div aria-hidden="true" className="section-grid" />
      <div className="shell relative space-y-10">
        <SectionHeader
          id="contact-title"
          eyebrow={sectionEyebrow}
          title={sectionTitle}
          subtitle={sectionSubtitle}
          actions={
            deskBadge && (
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-nominal-bg px-3.5 text-sm font-semibold text-nominal">
                <Headphones size={13} />
                {deskBadge.replace(/^●\s*/, "")}
              </span>
            )
          }
        />

        <div className="grid gap-5 md:grid-cols-3">
          {email && (
            <a href={safeHref(`mailto:${email.trim().replace(/[\x00-\x1f\x7f]/g, '')}`, '#')} className={cardClass}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <Mail size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-text-muted">Email</span>
                <span className="mt-1 block break-all text-sm font-semibold text-text-primary text-accent-light group-hover:underline">{email}</span>
              </span>
              <ArrowUpRight size={16} className="shrink-0 text-text-muted group-hover:text-accent-light" />
            </a>
          )}

          {phone && (
            <a href={safeHref(`tel:${phone.trim().replace(/[\x00-\x1f\x7f]/g, '')}`, '#')} className={cardClass}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
                <Phone size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-text-muted">Phone</span>
                <span className="num mt-1 block text-sm font-semibold text-accent-light group-hover:underline">{phone}</span>
              </span>
              <ArrowUpRight size={16} className="shrink-0 text-text-muted group-hover:text-accent-light" />
            </a>
          )}

          <div className="flex items-start gap-4 rounded-2xl border border-border-subtle bg-card p-6 shadow-card">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-blue-soft text-accent-light">
              <MapPin size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-text-muted">{facilityName}</span>
              <span className="mt-1 block text-sm leading-relaxed text-text-primary">{address}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
