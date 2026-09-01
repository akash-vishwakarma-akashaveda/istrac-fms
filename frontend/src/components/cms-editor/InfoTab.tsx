import { useEffect, useState } from "react"
import { useCms } from "../../context/cmsContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { Input, Panel, Textarea } from ".."
import { SaveBar } from "./SaveBar"

interface InfoBlockContent {
  aboutTitle?: string
  aboutText?: string
  aboutImageUrl?: string
  aboutImageAlt?: string
}

export function InfoTab() {
  const { cmsBlocks } = useCms()
  const info = cmsBlocks["info"] as InfoBlockContent | undefined

  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const [aboutTitle, setAboutTitle] = useState("")
  const [aboutText, setAboutText] = useState("")
  const [aboutImageUrl, setAboutImageUrl] = useState("")
  const [aboutImageAlt, setAboutImageAlt] = useState("")

  useEffect(() => {
    setAboutTitle(info?.aboutTitle ?? "")
    setAboutText(info?.aboutText ?? "")
    setAboutImageUrl(info?.aboutImageUrl ?? "")
    setAboutImageAlt(info?.aboutImageAlt ?? "")
  }, [info])

  async function handleSave() {
    try {
      await Promise.all([
        updateBlock.mutateAsync({
          blockKey: "info",
          content: {
            aboutTitle,
            aboutText,
            aboutImageUrl,
            aboutImageAlt,
          },
        }),
        updateBlock.mutateAsync({
          blockKey: "org_overview",
          content: {
            text: aboutText,
          },
        }),
      ])

      addToast({ message: "About ISTRAC section updated", variant: "success" })
      triggerRefresh()
    } catch {
      addToast({ message: "Failed to save", variant: "error" })
    }
  }

  return (
    <Panel title="About ISTRAC Center Details" meta="block:info">
      <div className="space-y-5">
        <Input
          id="about-title"
          label="Section Main Headline"
          value={aboutTitle}
          onChange={(e) => setAboutTitle(e.target.value)}
          placeholder="e.g. Information Infrastructure for Deep Space & Earth Observation Missions."
        />

        <Textarea
          id="about-text"
          label="Organization Overview & Center Mandate"
          rows={5}
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          placeholder="Enter ISTRAC mission background and operational mandate..."
          hint="Displayed prominently in the About section on the public landing page."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Input
            id="about-image-url"
            label="Center / Facility Image URL"
            value={aboutImageUrl}
            onChange={(e) => setAboutImageUrl(e.target.value)}
            placeholder="https://images.unsplash.com/photo-..."
            className="num text-xs"
            hint="Image shown in the 4:3 showcase frame beside the text."
          />

          <Input
            id="about-image-alt"
            label="Image Caption / Badge Text"
            value={aboutImageAlt}
            onChange={(e) => setAboutImageAlt(e.target.value)}
            placeholder="e.g. Mission Operations Complex (MOX-2 Bengaluru)"
          />
        </div>

        <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
      </div>
    </Panel>
  )
}
