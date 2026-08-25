import {
  Navbar,
  AnnouncementBar,
  Hero,
  FeaturedReports,
  MissionCalendar,
  AboutSection,
  ContactSection,
  Footer,
} from '../components'

export function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-page text-text-primary antialiased">
      {/* Keyboard accessibility skip link */}
      <a
        href="#main"
        className="eyebrow sr-only rounded-md border border-accent bg-card px-3 py-2 text-accent-light focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60]"
      >
        Skip to content
      </a>

      <Navbar />
      <AnnouncementBar />
      <main id="main">
        <Hero />
        <FeaturedReports />
        <MissionCalendar />
        <AboutSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  )
}
