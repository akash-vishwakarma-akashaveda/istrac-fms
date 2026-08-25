import { useEffect, useState } from 'react'
import { useCms } from '../../context/cmsContext'
import { useUpdateCmsBlock } from '../../hooks/useUpdateCmsBlock'
import { useToastStore } from '../../store/toastStore'
import { usePreviewRefresh } from '../../context/PreviewRefreshContext'
import { Input, Panel, Textarea } from '..'
import { SaveBar } from './SaveBar'

interface InfoBlockContent {
  aboutTitle?: string
  aboutText?: string
  aboutImageUrl?: string
  aboutImageAlt?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
}

export function InfoTab() {
  const { cmsBlocks } = useCms()
  const info = cmsBlocks['info'] as InfoBlockContent | undefined

  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const [aboutTitle, setAboutTitle] = useState('')
  const [aboutText, setAboutText] = useState('')
  const [aboutImageUrl, setAboutImageUrl] = useState('')
  const [aboutImageAlt, setAboutImageAlt] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    setAboutTitle(info?.aboutTitle ?? '')
    setAboutText(info?.aboutText ?? '')
    setAboutImageUrl(info?.aboutImageUrl ?? '')
    setAboutImageAlt(info?.aboutImageAlt ?? '')
    setContactEmail(info?.contactEmail ?? '')
    setContactPhone(info?.contactPhone ?? '')
    setAddress(info?.address ?? '')
  }, [info])

  async function handleSave() {
    try {
      await Promise.all([
        updateBlock.mutateAsync({
          blockKey: 'info',
          content: {
            aboutTitle,
            aboutText,
            aboutImageUrl,
            aboutImageAlt,
            contactEmail,
            contactPhone,
            address,
          },
        }),
        updateBlock.mutateAsync({
          blockKey: 'org_overview',
          content: {
            text: aboutText,
          },
        }),
        updateBlock.mutateAsync({
          blockKey: 'contact_info',
          content: {
            email: contactEmail,
            phone: contactPhone,
            address,
          },
        }),
      ])

      addToast({ message: 'About ISTRAC & Contact info updated', variant: 'success' })
      triggerRefresh()
    } catch {
      addToast({ message: 'Failed to save', variant: 'error' })
    }
  }

  return (
    <Panel title="About ISTRAC & Support Desk" meta="block:info" flush>
      <div className="p-4 space-y-6">
        {/* About Section Settings */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent-light border-b border-border-subtle pb-2">
            About Section Details
          </h3>

          <Input
            id="about-title"
            label="Section Headline"
            value={aboutTitle}
            onChange={(e) => setAboutTitle(e.target.value)}
            placeholder="e.g. About ISTRAC Telemetry Infrastructure"
          />

          <Textarea
            id="about-text"
            label="Organization Overview & Mandate"
            rows={4}
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            placeholder="Enter ISTRAC mission background and operational mandate..."
            hint="Displayed prominently in the About section on the public landing page."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Input
              id="about-image-url"
              label="About Section Image URL"
              value={aboutImageUrl}
              onChange={(e) => setAboutImageUrl(e.target.value)}
              placeholder="https://example.com/mox-campus.jpg"
              className="num text-xs"
              hint="If empty, a mission control radar graphic will render."
            />

            <Input
              id="about-image-alt"
              label="Image Alt Text / Label"
              value={aboutImageAlt}
              onChange={(e) => setAboutImageAlt(e.target.value)}
              placeholder="e.g. Mission Operations Complex (MOX-2)"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4 pt-4 border-t border-border-subtle">
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent-light border-b border-border-subtle pb-2">
            Support Desk & Campus Location
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id="contact-email"
              label="Helpdesk Email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="num"
              placeholder="ground-support@istrac.isro.gov.in"
            />

            <Input
              id="contact-phone"
              label="EPABX Phone Line"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="num"
              placeholder="+91 80 2838 4000"
            />
          </div>

          <Input
            id="contact-address"
            label="Campus Headquarters Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="ISTRAC Campus, Peenya Industrial Area, Bengaluru - 560058"
          />
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
