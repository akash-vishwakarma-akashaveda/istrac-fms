import { ArrowUpRight, Mail, Phone, MapPin, Headphones } from "lucide-react"
import { useCms, DEFAULT_CMS_BLOCKS } from "../context/cmsContext"

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

  return (
    <section id="contact" className="border-b border-border-subtle bg-page py-20 sm:py-24" aria-labelledby="contact-title">
      <div className="shell grid items-stretch gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Left Side: Information */}
        <div className="flex flex-col justify-between lg:col-span-6">
          <div>
            <p className="eyebrow flex items-center gap-2.5 text-accent-light">
              <span aria-hidden="true" className="h-2.5 w-px bg-accent-light" />
              {sectionEyebrow}
            </p>

            <h2
              id="contact-title"
              className="display mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
            >
              {sectionTitle}
            </h2>

            <p className="mt-4 text-base leading-relaxed text-text-secondary">
              {sectionSubtitle}
            </p>
          </div>

          <div className="mt-8 flex items-start gap-3.5 rounded-2xl border border-border-default bg-card p-5 shadow-card">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-light border border-accent/25">
              <MapPin size={20} />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary">{facilityName}</h4>
              <p className="num mt-1 text-xs leading-relaxed text-text-muted">{address}</p>
            </div>
          </div>
        </div>

        {/* Right Side: Direct Support Channels */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-card shadow-2xl lg:col-span-6">
          <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-6 py-4">
            <div className="flex items-center gap-2">
              <Headphones size={16} className="text-accent-light" />
              <span className="eyebrow text-text-muted">Direct Support Channels</span>
            </div>
            <span className="num text-[11px] text-nominal font-medium">{deskBadge}</span>
          </div>

          <div className="divide-y divide-border-subtle flex-1 flex flex-col justify-around">
            {email && (
              <a
                href={`mailto:${email}`}
                className="group flex items-center gap-4 px-6 py-6 transition-colors duration-150 hover:bg-card-hover"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface border border-border-subtle text-accent-light shadow-inner">
                  <Mail size={20} strokeWidth={1.8} />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="eyebrow block text-[10px] text-text-dim">CAMPUS SMTP DESK</span>
                  <span className="num mt-1 block truncate text-sm font-semibold text-text-primary group-hover:text-accent-light">
                    {email}
                  </span>
                </div>

                <ArrowUpRight
                  size={18}
                  className="shrink-0 text-text-dim transition-colors duration-150 group-hover:text-accent-light"
                />
              </a>
            )}

            {phone && (
              <a
                href={`tel:${phone}`}
                className="group flex items-center gap-4 px-6 py-6 transition-colors duration-150 hover:bg-card-hover"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface border border-border-subtle text-nominal shadow-inner">
                  <Phone size={20} strokeWidth={1.8} />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="eyebrow block text-[10px] text-text-dim">OPERATIONS EPABX LINE</span>
                  <span className="num mt-1 block truncate text-sm font-semibold text-text-primary group-hover:text-accent-light">
                    {phone}
                  </span>
                </div>

                <ArrowUpRight
                  size={18}
                  className="shrink-0 text-text-dim transition-colors duration-150 group-hover:text-accent-light"
                />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
