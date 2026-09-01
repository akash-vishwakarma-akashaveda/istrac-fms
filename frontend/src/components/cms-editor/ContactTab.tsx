import { useEffect, useState } from "react"
import { Headphones, Mail, Phone, MapPin } from "lucide-react"
import { useCms, DEFAULT_CMS_BLOCKS } from "../../context/cmsContext"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { Input, Panel, Textarea } from ".."
import { SaveBar } from "./SaveBar"

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

export function ContactTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const existingInfo = cmsBlocks["info"] as Record<string, string> | undefined
  const existingContact = cmsBlocks["contact_info"] as ContactBlockContent | undefined

  const [sectionEyebrow, setSectionEyebrow] = useState("Support & Helpdesk")
  const [sectionTitle, setSectionTitle] = useState("Need Help with ISTRAC-SIMS?")
  const [sectionSubtitle, setSectionSubtitle] = useState(
    "Reach the ground station support engineering team for departmental access authorization, satellite uplink feeds, and telemetry pipeline queries."
  )
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [deskBadge, setDeskBadge] = useState("● 24/7 MISSION DESK")
  const [facilityName, setFacilityName] = useState("Ground Facility Headquarters")

  useEffect(() => {
    setSectionEyebrow(existingContact?.sectionEyebrow || "Support & Helpdesk")
    setSectionTitle(existingContact?.sectionTitle || "Need Help with ISTRAC-SIMS?")
    setSectionSubtitle(
      existingContact?.sectionSubtitle ||
        "Reach the ground station support engineering team for departmental access authorization, satellite uplink feeds, and telemetry pipeline queries."
    )
    setEmail(
      existingContact?.email ||
        existingInfo?.contactEmail ||
        (DEFAULT_CMS_BLOCKS["info"].contactEmail as string) ||
        "support@istrac.isro.gov.in"
    )
    setPhone(
      existingContact?.phone ||
        existingInfo?.contactPhone ||
        (DEFAULT_CMS_BLOCKS["info"].contactPhone as string) ||
        "+91 80 2838 4000"
    )
    setAddress(
      existingContact?.address ||
        existingInfo?.address ||
        (DEFAULT_CMS_BLOCKS["info"].address as string) ||
        "ISTRAC Campus, Plot No. 12 & 13, 3rd Main, 2nd Phase, Peenya Industrial Area, Bengaluru, Karnataka 560058"
    )
    setDeskBadge(existingContact?.deskBadge || "● 24/7 MISSION DESK")
    setFacilityName(existingContact?.facilityName || "Ground Facility Headquarters")
  }, [existingContact, existingInfo])

  async function handleSave() {
    try {
      await Promise.all([
        updateBlock.mutateAsync({
          blockKey: "contact_info",
          content: {
            sectionEyebrow,
            sectionTitle,
            sectionSubtitle,
            email,
            phone,
            address,
            deskBadge,
            facilityName,
          },
        }),
        updateBlock.mutateAsync({
          blockKey: "info",
          content: {
            ...(existingInfo || {}),
            contactEmail: email,
            contactPhone: phone,
            address,
          },
        }),
      ])

      addToast({ message: "Contact & Helpdesk information updated", variant: "success" })
      triggerRefresh()
    } catch {
      addToast({ message: "Failed to save contact information", variant: "error" })
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro strip */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-accent/30 bg-accent/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent-light shrink-0">
            <Headphones size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Support & Contact Channels</h4>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Customize the landing page helpdesk information, campus address, SMTP desk email, and EPABX hotlines.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: SECTION HEADLINES */}
      <Panel title="Contact Section Headlines" meta="block:contact_info">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="contact-eyebrow"
              label="Eyebrow Tagline"
              value={sectionEyebrow}
              onChange={(e) => setSectionEyebrow(e.target.value)}
              placeholder="e.g. Support & Helpdesk"
            />

            <Input
              id="contact-title"
              label="Section Main Headline"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="e.g. Need Help with ISTRAC-SIMS?"
            />
          </div>

          <Textarea
            id="contact-subtitle"
            label="Section Description"
            rows={2}
            value={sectionSubtitle}
            onChange={(e) => setSectionSubtitle(e.target.value)}
            placeholder="Reach the ground station support engineering team..."
          />
        </div>
      </Panel>

      {/* SECTION 2: CHANNELS & CAMPUS DETAILS */}
      <Panel title="Support Channels & Campus Location" meta="block:contact_info">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="contact-email"
              label="Campus SMTP Desk Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="support@istrac.isro.gov.in"
              className="num"
            />

            <Input
              id="contact-phone"
              label="Operations EPABX Phone Line"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 80 2838 4000"
              className="num font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="contact-badge"
              label="Mission Desk Badge Text"
              value={deskBadge}
              onChange={(e) => setDeskBadge(e.target.value)}
              placeholder="● 24/7 MISSION DESK"
              className="num text-xs"
            />

            <Input
              id="contact-facility"
              label="Facility Box Title"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="Ground Facility Headquarters"
            />
          </div>

          <Textarea
            id="contact-address"
            label="Headquarters Postal Address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="ISTRAC Campus, Plot No. 12 & 13, 3rd Main, 2nd Phase, Peenya Industrial Area, Bengaluru, Karnataka 560058"
          />

          {/* LIVE PREVIEW CARD */}
          <div className="space-y-2 pt-2">
            <span className="col-label block">Live Helpdesk Card Preview</span>
            <div className="p-4 rounded-xl border border-border-default bg-[#0b1220] space-y-3">
              <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Headphones size={15} className="text-accent-light" />
                  <span className="text-xs font-bold text-white">Direct Support Channels</span>
                </div>
                <span className="num text-[10px] text-nominal font-semibold">{deskBadge}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface border border-border-subtle">
                  <Mail size={16} className="text-accent-light shrink-0" />
                  <div className="truncate">
                    <span className="text-[9px] uppercase font-bold text-text-dim block">Campus SMTP Desk</span>
                    <span className="text-xs font-semibold text-white truncate block num">{email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface border border-border-subtle">
                  <Phone size={16} className="text-nominal shrink-0" />
                  <div className="truncate">
                    <span className="text-[9px] uppercase font-bold text-text-dim block">Operations EPABX</span>
                    <span className="text-xs font-semibold text-white truncate block num">{phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 text-[11px] text-text-dim">
                <MapPin size={14} className="text-accent-light shrink-0 mt-0.5" />
                <span className="line-clamp-1">{address}</span>
              </div>
            </div>
          </div>

          <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
        </div>
      </Panel>
    </div>
  )
}
