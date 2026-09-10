import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { cmsApi } from '../api'
import { wsClient } from '../lib/ws'

interface CmsContextValue {
  cmsBlocks: Record<string, Record<string, unknown>>
  isLoading: boolean
  refetch: () => Promise<void>
}

// Authoritative ISTRAC Mission & Network Default Fallbacks
export const DEFAULT_CMS_BLOCKS: Record<string, Record<string, unknown>> = {
  nav_header: {
    brandTitle: 'ISTRAC',
    brandHighlight: '-SIMS',
    brandSubtitle: 'ISRO Ground Network',
  },
  nav_footer: {
    copyrightText: 'ISTRAC-SIMS · ISRO Ground Network. All rights reserved.',
    subText: 'BLR · MOX Complex',
  },
  hero: {
    title: 'ISRO Telemetry, Tracking & Command Network',
    subtitle: 'The nerve centre for spacecraft operations, deep space tracking, launch vehicle telemetry, and orbit determination across all Indian space missions.',
    ctaText: 'Enter Mission Portal',
    badgeText: 'ISTRAC Ground Network Active · 24/7 Mission Operations',
    imageUrl: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Indian Deep Space Network (IDSN) 32-Meter Antenna Dish at Byalalu',
    slides: [
      {
        url: 'https://images.unsplash.com/photo-1517976487515-56839a85703f?auto=format&fit=crop&w=1200&q=80',
        caption: 'Indian Deep Space Network (IDSN) 32-Meter Antenna Dish at Byalalu',
        alt: 'IDSN 32-Meter Antenna',
      },
      {
        url: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
        caption: 'Mission Operations Complex (MOX) Flight Dynamics & Control Consoles',
        alt: 'MOX Flight Control Consoles',
      },
      {
        url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
        caption: 'Real-time Global Satellite Telemetry Downlink Stream & Constellation Tracking',
        alt: 'Satellite Constellation Network',
      },
      {
        url: 'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?auto=format&fit=crop&w=1200&q=80',
        caption: 'ISTRAC Bengaluru Main Control Room Operations Gallery',
        alt: 'Control Room Gallery',
      },
    ],
  },
  announcements: {
    visible: true,
    backgroundColor: 'navy',
    text: 'MISSION UPDATE: Aditya-L1 Halo Orbit Stationkeeping & Chandrayaan-3 Telemetry Sync Verified · All Tracking Stations Nominal',
    items: [
      {
        id: 'notif-1',
        title: 'MISSION UPDATE: Aditya-L1 Halo Orbit Stationkeeping',
        message: 'Doppler lock confirmed on 2.2 GHz S-Band. Chandrayaan-3 Telemetry Sync Verified · All Tracking Stations Nominal.',
        category: 'MISSION',
        timestamp: '10 Mins Ago',
      },
      {
        id: 'notif-2',
        title: 'IDSN 32-Meter Deep Space Dish Calibration Complete',
        message: 'Byalalu IDSN 32m dish completed autotrack calibration; cryo-receiver noise temperature measured at nominal 12.4K.',
        category: 'MAINTENANCE',
        timestamp: '35 Mins Ago',
      },
      {
        id: 'notif-3',
        title: 'Cartosat-3 S-Band Pass Acquisition Scheduled',
        message: 'Downlink window configured for 14:30 UTC over Bengaluru MOX-1 primary ground terminal.',
        category: 'PASS',
        timestamp: '1 Hour Ago',
      },
      {
        id: 'notif-4',
        title: 'Downrange Ground Relays Synchronized',
        message: 'Port Blair & Mauritius telemetry relays synchronized for upcoming launch vehicle trajectory tracking.',
        category: 'RELAY',
        timestamp: '3 Hours Ago',
      },
      {
        id: 'notif-5',
        title: 'NETRA IS4OM Space Debris Conjunction Screen Passed',
        message: 'Zero high-risk orbital conjunction events identified for operational Indian spacecraft in 72-hour screening.',
        category: 'SECURITY',
        timestamp: 'Today 08:00 UTC',
      },
    ],
  },
  access_panel: {
    facilitiesTitle: 'Multi-Facility Ground Network',
    facilitiesDesc: 'ISTRAC telemetry feeds and command uplinks are distributed across primary centres and international downrange tracking stations.',
    reportsTitle: 'Department Repositories & Flight Reports',
    reportsDesc: 'Log in with your ISTRAC credentials to access department-segregated mission logs, orbit ephemeris, and telemetry data files.',
  },
  calendar_events: {
    title: 'Upcoming Events & Mission Calendar',
    subtitle: 'Live tracking passes, orbit maneuvers, and ground station maintenance.',
    layoutMode: 'dual_month',
    showLegend: true,
    showQuickStats: true,
  },
  department_pages: {
    customContent: {},
    order: [] as string[],
  },
  banner: {
    visible: true,
    title: 'Nerve Centre for Indian Space Exploration',
    subtitle: 'Providing round-the-clock tracking, navigation guidance, and mission data transmission for India’s satellite fleet and interplanetary voyages.',
    ctaText: 'Access Mission Portal',
    ctaHref: '/login',
  },
  info: {
    aboutEyebrow: 'About Telemetry Infrastructure',
    aboutTitle: 'About ISTRAC (ISRO Telemetry, Tracking and Command Network)',
    aboutText: 'ISTRAC is a premier centre of the Indian Space Research Organisation (ISRO) headquartered in Bengaluru. ISTRAC has the primary mandate of providing telemetry, tracking and command (TTC) support for all satellite and launch vehicle missions of ISRO. The centre also operates the Indian Deep Space Network (IDSN) at Byalalu for planetary exploration, the IS4OM facility for space situational awareness, and global downrange stations across India and overseas.',
    aboutImageUrl: 'https://images.unsplash.com/photo-1581822261290-991b38693d1b?auto=format&fit=crop&w=1000&q=80',
    aboutImageAlt: 'Mission Operations Complex (MOX-2 Bengaluru)',
    facilityTag: 'ISTRAC HEADQUARTERS',
    frequencyTag: 'AOS 2.2 GHz',
    primaryNodeLabel: 'PRIMARY CONTROL NODE',
    primaryNodeLocation: 'Bengaluru MOX Complex (BLR)',
    ctaText: 'Contact Mission Support',
    ctaHref: '#contact',
    assurances: [
      'Permission-aware departmental access controls (RBAC)',
      'Tamper-evident append-only audit activity logging',
      'Multi-ground station satellite scoping (BLR / SHAR / PBL / MAU)',
      'Real-time WebSocket telemetry pass notifications',
    ],
    contactEmail: 'support@istrac.isro.gov.in',
    contactPhone: '+91 80 2838 4000',
    address: 'ISTRAC Campus, Plot No. 12 & 13, 3rd Main, 2nd Phase, Peenya Industrial Area, Bengaluru, Karnataka - 560058, India',
  },
  quick_stats: {
    stat1Value: '5 Stations',
    stat1Label: 'Global Ground Network',
    stat1Icon: 'globe',
    stat2Value: '10+ Missions',
    stat2Label: 'Deep Space & LEO',
    stat2Icon: 'radio',
    stat3Value: '24/7 MOX Ops',
    stat3Label: 'Continuous Telemetry',
    stat3Icon: 'activity',
    stat4Value: 'SHA-256',
    stat4Label: 'Cryptographic Integrity',
    stat4Icon: 'shield',
  },
}

const CmsContext = createContext<CmsContextValue>({
  cmsBlocks: DEFAULT_CMS_BLOCKS,
  isLoading: false,
  refetch: async () => {},
})

export function CmsProvider({ children }: { children: ReactNode }) {
  const [cmsBlocks, setCmsBlocks] = useState<Record<string, Record<string, unknown>>>(DEFAULT_CMS_BLOCKS)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchBlocks() {
    try {
      const blockMap = await cmsApi.getBlocks()
      if (blockMap && typeof blockMap === 'object') {
        setCmsBlocks((prev) => ({
          ...prev,
          ...(blockMap as Record<string, Record<string, unknown>>),
        }))
      }
    } catch {
      // Fallback to default CMS blocks
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBlocks()
    wsClient.connect()

    const handleCmsUpdate = (_evt: string, payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const update = payload as { blockKey?: string; content?: Record<string, unknown> }
      if (update.blockKey && update.content) {
        setCmsBlocks((prev) => ({ ...prev, [update.blockKey!]: update.content! }))
      } else {
        fetchBlocks()
      }
    }

    const unsub1 = wsClient.subscribe('CMS_UPDATE', handleCmsUpdate)
    const unsub2 = wsClient.subscribe('cms.update', handleCmsUpdate)
    const unsub3 = wsClient.subscribe('cms', handleCmsUpdate)

    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  }, [])

  useEffect(() => {
    const navHeader = cmsBlocks['nav_header'] as Record<string, any> | undefined
    if (navHeader?.brandTitle) {
      const brand = `${navHeader.brandTitle}${navHeader.brandHighlight || ''}`
      const subtitle = navHeader.brandSubtitle ? ` · ${navHeader.brandSubtitle}` : ''
      document.title = `${brand}${subtitle}`
    }
  }, [cmsBlocks])

  return (
    <CmsContext.Provider value={{ cmsBlocks, isLoading, refetch: fetchBlocks }}>
      {children}
    </CmsContext.Provider>
  )
}

export function useCms() {
  return useContext(CmsContext)
}