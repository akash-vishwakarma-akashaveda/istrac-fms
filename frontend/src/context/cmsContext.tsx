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
    noticeBoard: [
      {
        id: 'nb-1',
        title: 'Training Program',
        subtitle: 'Spacecraft Operations Training',
        date: '2026-08-23',
        time: '10:00 AM – 04:00 PM IST',
        category: 'TRAINING',
        department: 'TTC',
        station: 'BLR MOX-1',
        description: 'Comprehensive simulation training on spacecraft telemetry ingestion and contingency command protocols.',
      },
      {
        id: 'nb-2',
        title: 'Satellite Birthday',
        subtitle: 'ASTROSAT 7th Anniversary',
        date: '2026-08-28',
        time: 'All Day',
        category: 'ANNIVERSARY',
        department: 'FDD',
        station: 'ISTRAC Bengaluru',
        description: 'Commemorating 7 years of successful multi-wavelength astronomical observations and orbital operations.',
      },
      {
        id: 'nb-3',
        title: 'Maneuver Campaign',
        subtitle: 'Orbit Maintenance Maneuver',
        date: '2026-09-02',
        time: '01:00 PM IST',
        category: 'MANEUVER',
        department: 'FDD',
        station: 'IDSN Byalalu',
        description: 'Scheduled stationkeeping orbit correction burn with Doppler telemetry lock.',
      },
      {
        id: 'nb-4',
        title: 'System Maintenance',
        subtitle: 'Ground Station Maintenance',
        date: '2026-09-05',
        time: '09:00 AM – 05:00 PM IST',
        category: 'MAINTENANCE',
        department: 'GSO',
        station: 'ISTRAC-SHAR',
        description: '18-meter parabolic antenna receiver alignment and cryogenic amplifier calibration.',
      },
      {
        id: 'nb-5',
        title: 'Review Meeting',
        subtitle: 'Mission Review Meeting',
        date: '2026-09-07',
        time: '11:00 AM – 12:30 PM IST',
        category: 'REVIEW',
        department: 'MOX',
        station: 'Conference Hall A',
        description: 'Quarterly telemetry pipeline throughput and storage archive integrity audit.',
      },
    ],
    events: [
      {
        id: 'ev-1',
        title: 'Cartosat-3 S-Band Pass Acquisition',
        date: '2026-08-08',
        time: '10:15 AM IST',
        category: 'PASS',
        department: 'TTC',
        station: 'BLR-MOX',
        description: 'Scheduled low Earth orbit pass telemetry downlink and health packet verification.',
      },
      {
        id: 'ev-2',
        title: 'Ground Antenna Autotrack Maintenance',
        date: '2026-08-07',
        time: '09:00 AM – 01:00 PM IST',
        category: 'MAINTENANCE',
        department: 'GSO',
        station: 'BLR Station Dish 1',
        description: 'Feed horn RF calibration and servo azimuth drive inspection.',
      },
      {
        id: 'ev-3',
        title: 'Aditya-L1 Halo Orbit Maneuver',
        date: '2026-08-10',
        time: '02:00 PM IST',
        category: 'MANEUVER',
        department: 'FDD',
        station: 'IDSN Byalalu (32m)',
        description: 'High-precision ranging and Doppler telemetry correlation for halo orbit stationkeeping.',
      },
      {
        id: 'ev-4',
        title: 'Oceansat-3 Downlink & Maintenance Calibration',
        date: '2026-08-11',
        time: '04:45 PM IST',
        category: 'PASS',
        department: 'TTC',
        station: 'Port Blair Station',
        description: 'Ocean color monitor data dump verification over downrange station.',
      },
      {
        id: 'ev-5',
        title: 'Deep Space Receiver Routine Maintenance',
        date: '2026-08-14',
        time: '10:00 AM – 03:00 PM IST',
        category: 'MAINTENANCE',
        department: 'GSO',
        station: 'IDSN Byalalu',
        description: 'Ultra-low noise amplifier cryo-cooler service.',
      },
      {
        id: 'ev-6',
        title: 'RISAT-2B Radar Telemetry Pass',
        date: '2026-08-15',
        time: '06:30 AM IST',
        category: 'PASS',
        department: 'TTC',
        station: 'BLR-MOX',
        description: 'Synthetic aperture radar imaging telemetry dump and raw packet staging.',
      },
      {
        id: 'ev-7',
        title: 'NETRA Space Situational Conjunction Analysis',
        date: '2026-08-17',
        time: '11:00 AM IST',
        category: 'MANEUVER',
        department: 'NETRA',
        station: 'IS4OM Bengaluru',
        description: 'Orbital debris proximity screening and collision avoidance maneuver (CAM) assessment.',
      },
      {
        id: 'ev-8',
        title: 'Scheduled Ground Station S-Band Maintenance',
        date: '2026-08-21',
        time: '08:00 AM – 12:00 PM IST',
        category: 'MAINTENANCE',
        department: 'GSO',
        station: 'Mauritius Station',
        description: 'Telemetry demodulator firmware upgrade and BER test validation.',
      },
      {
        id: 'ev-9',
        title: 'Gaganyaan Ground Segment Simulation Special Activity',
        date: '2026-08-25',
        time: '09:00 AM – 06:00 PM IST',
        category: 'SPECIAL',
        department: 'MOX',
        station: 'All Stations',
        description: 'Full crew module recovery communications simulation and multi-ground link test.',
      },
      {
        id: 'ev-10',
        title: 'PSLV Downrange Trajectory Tracking Maintenance',
        date: '2026-09-05',
        time: '07:00 AM – 11:00 AM IST',
        category: 'MAINTENANCE',
        department: 'GSO',
        station: 'ISTRAC-SHAR',
        description: 'Precision radar transponder interrogation and tracking antenna calibration.',
      },
      {
        id: 'ev-11',
        title: 'GSAT Telemetry Transponder Check',
        date: '2026-09-12',
        time: '01:30 PM – 05:30 PM IST',
        category: 'MAINTENANCE',
        department: 'TTC',
        station: 'BLR-MOX',
        description: 'Geostationary beacon monitoring and EIRP measurement.',
      },
      {
        id: 'ev-12',
        title: 'Spacecraft Operations Quarterly System Maintenance',
        date: '2026-09-18',
        time: '10:00 AM – 04:00 PM IST',
        category: 'MAINTENANCE',
        department: 'GSO',
        station: 'BLR-MOX-2',
        description: 'UPS failover test and core telemetry router redundancy switchover.',
      },
      {
        id: 'ev-13',
        title: 'Chandrayaan Data Archive Special Release Activity',
        date: '2026-09-29',
        time: '02:00 PM IST',
        category: 'SPECIAL',
        department: 'MOX',
        station: 'ISTRAC Bengaluru',
        description: 'Public release of calibrated lunar science datasets and payload ephemeris.',
      },
    ],
  },
  department_pages: {
    customContent: {},
  },
  banner: {
    visible: true,
    title: 'Nerve Centre for Indian Space Exploration',
    subtitle: 'Providing round-the-clock tracking, navigation guidance, and mission data transmission for India’s satellite fleet and interplanetary voyages.',
    ctaText: 'Access Mission Portal',
    ctaHref: '/login',
  },
  info: {
    aboutTitle: 'About ISTRAC (ISRO Telemetry, Tracking and Command Network)',
    aboutText: 'ISTRAC is a premier centre of the Indian Space Research Organisation (ISRO) headquartered in Bengaluru. ISTRAC has the primary mandate of providing telemetry, tracking and command (TTC) support for all satellite and launch vehicle missions of ISRO. The centre also operates the Indian Deep Space Network (IDSN) at Byalalu for planetary exploration, the IS4OM facility for space situational awareness, and global downrange stations across India and overseas.',
    aboutImageUrl: 'https://images.unsplash.com/photo-1581822261290-991b38693d1b?auto=format&fit=crop&w=1000&q=80',
    aboutImageAlt: 'Mission Operations Complex (MOX-2 Bengaluru)',
    contactEmail: 'support@istrac.isro.gov.in',
    contactPhone: '+91 80 2838 4000',
    address: 'ISTRAC Campus, Plot No. 12 & 13, 3rd Main, 2nd Phase, Peenya Industrial Area, Bengaluru, Karnataka - 560058, India',
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

  return (
    <CmsContext.Provider value={{ cmsBlocks, isLoading, refetch: fetchBlocks }}>
      {children}
    </CmsContext.Provider>
  )
}

export function useCms() {
  return useContext(CmsContext)
}