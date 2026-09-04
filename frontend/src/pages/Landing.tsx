import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Navbar } from "../components/Navbar"
import { Hero } from "../components/Hero"
import { QuickStatsBanner } from "../components/QuickStatsBanner"
import { OperationalDivisions } from "../components/OperationalDivisions"
import { FeaturedReports } from "../components/FeaturedReports"
import { MissionCalendar } from "../components/MissionCalendar"
import { AboutSection } from "../components/AboutSection"
import { ContactSection } from "../components/ContactSection"
import { Footer } from "../components/Footer"
import { AnnouncementBar } from "../components/AnnouncementBar"
import { useCms } from "../context/cmsContext"

export function Landing() {
  const queryClient = useQueryClient()
  const { refetch } = useCms()

  console.log("🔄 LandingPage re-rendered at", Date.now())
  // ...

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === "CMS_PREVIEW_REFRESH") {
        refetch()
        queryClient.invalidateQueries({ queryKey: ["cms"] })
      }
      // Scroll to section when tab is clicked in CMS editor
      if (event.data?.type === "CMS_SCROLL_TO") {
        const key = event.data.sectionKey
        const el =
          document.getElementById(`cms-section-${key}`) ||
          document.getElementById(key) ||
          document.getElementById(key === "nav" ? "cms-section-nav" : key === "footer" ? "cms-section-footer" : "")

        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
          el.style.outline = "2px solid rgba(29, 114, 254, 0.6)"
          el.style.outlineOffset = "4px"
          setTimeout(() => {
            el.style.outline = ""
            el.style.outlineOffset = ""
          }, 2000)
        }
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [refetch, queryClient])

  return (
    <div className="min-h-screen overflow-x-hidden bg-page text-text-primary antialiased">
      {/* Keyboard accessibility skip link */}
      <a
        href="#main"
        className="eyebrow sr-only rounded-md border border-accent bg-card px-3 py-2 text-accent-light focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60]"
      >
        Skip to content
      </a>

      <div id="cms-section-nav"><Navbar /></div>
      <div id="cms-section-announcements"><AnnouncementBar /></div>
      <main id="main">
        <div id="cms-section-hero"><Hero /></div>
        <div id="cms-section-quick_stats"><QuickStatsBanner /></div>
        <div id="cms-section-department_pages"><OperationalDivisions /></div>
        <div id="cms-section-featured_reports"><FeaturedReports /></div>
        <div id="cms-section-calendar_events"><MissionCalendar /></div>
        <div id="cms-section-about"><AboutSection /></div>
        <div id="cms-section-contact_info"><ContactSection /></div>
      </main>
      <div id="cms-section-footer"><Footer /></div>
    </div>
  )
}
