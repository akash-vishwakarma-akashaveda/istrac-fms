import { useEffect, useState } from "react"
import { Building2, Layers, ExternalLink, CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useCms } from "../../context/cmsContext"
import { usePreviewRefresh } from "../../context/PreviewRefreshContext"
import { useUpdateCmsBlock } from "../../hooks/useUpdateCmsBlock"
import { useToastStore } from "../../store/toastStore"
import { departmentsApi, type Department } from "../../api/departments.api"
import { Input, Panel, Textarea } from ".."
import { SaveBar } from "./SaveBar"

export interface DepartmentCmsData {
  title?: string
  code?: string
  labLead?: string
  roomLocation?: string
  facilities?: string[]
  customMandate?: string
  leadRole?: string
}

export interface DepartmentPagesBlock {
  sectionEyebrow?: string
  sectionTitle?: string
  sectionSubtitle?: string
  showFileCount?: boolean
  showLeadOfficer?: boolean
  customContent?: Record<string, DepartmentCmsData>
}

export function DepartmentPagesTab() {
  const { cmsBlocks } = useCms()
  const updateBlock = useUpdateCmsBlock()
  const addToast = useToastStore((s) => s.addToast)
  const { triggerRefresh } = usePreviewRefresh()

  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<string>("")

  const existing = cmsBlocks["department_pages"] as DepartmentPagesBlock | undefined

  // Section level headers
  const [sectionEyebrow, setSectionEyebrow] = useState("ISRO ISTRAC COMMAND SECTORS")
  const [sectionTitle, setSectionTitle] = useState("Operational Divisions & Facilities")
  const [sectionSubtitle, setSectionSubtitle] = useState(
    "Specialized engineering directorates processing satellite downlinks, mission trajectory maneuvers, space situational awareness, and global antenna telemetry."
  )
  const [showFileCount, setShowFileCount] = useState(true)
  const [showLeadOfficer, setShowLeadOfficer] = useState(true)

  // Per-division custom content dictionary
  const [allContent, setAllContent] = useState<Record<string, DepartmentCmsData>>({})

  useEffect(() => {
    departmentsApi.getPublicDepartments().then((list) => {
      setDepartments(list || [])
      if (list && list.length > 0 && !selectedDeptId) {
        setSelectedDeptId(list[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (existing) {
      if (existing.sectionEyebrow !== undefined) setSectionEyebrow(existing.sectionEyebrow)
      if (existing.sectionTitle !== undefined) setSectionTitle(existing.sectionTitle)
      if (existing.sectionSubtitle !== undefined) setSectionSubtitle(existing.sectionSubtitle)
      if (existing.showFileCount !== undefined) setShowFileCount(existing.showFileCount)
      if (existing.showLeadOfficer !== undefined) setShowLeadOfficer(existing.showLeadOfficer)
      if (existing.customContent) setAllContent(existing.customContent)
    }
  }, [existing])

  const selectedDept = departments.find((d) => d.id === selectedDeptId)
  const currentData = selectedDeptId ? allContent[selectedDeptId] || {} : {}

  // Fallback defaults from database department object
  const effectiveTitle = currentData.title !== undefined ? currentData.title : (selectedDept?.name || "")
  const effectiveCode = currentData.code !== undefined ? currentData.code : (selectedDept?.code || "")
  const effectiveLead = currentData.labLead !== undefined ? currentData.labLead : (selectedDept?.pageLeadOfficer || "")
  const effectiveRole = currentData.leadRole !== undefined ? currentData.leadRole : (selectedDept?.pageLeadRole || "Lead Astrodynamics Specialist")
  const effectiveLocation = currentData.roomLocation !== undefined ? currentData.roomLocation : (selectedDept?.pageContact ? `ISTRAC ${selectedDept.code || "MOX"} Complex` : "MOX-2 Building, ISTRAC Bengaluru")
  const effectiveMandate = currentData.customMandate !== undefined ? currentData.customMandate : (selectedDept?.pageAbout || selectedDept?.description || "")

  function updateCurrent(patch: Partial<DepartmentCmsData>) {
    if (!selectedDeptId) return
    setAllContent((prev) => ({
      ...prev,
      [selectedDeptId]: {
        ...(prev[selectedDeptId] || {}),
        ...patch,
      },
    }))
  }

  function handleSave() {
    updateBlock.mutate(
      {
        blockKey: "department_pages",
        content: {
          sectionEyebrow,
          sectionTitle,
          sectionSubtitle,
          showFileCount,
          showLeadOfficer,
          customContent: allContent,
        },
      },
      {
        onSuccess: () => {
          addToast({ message: "Divisions & Showcase CMS content updated", variant: "success" })
          triggerRefresh()
        },
        onError: () => {
          addToast({ message: "Failed to save division content", variant: "error" })
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* DIRECT NAVIGATION / LINK TO DEPARTMENTS MANAGEMENT */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-accent/30 bg-accent/10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center text-accent-light shrink-0">
            <Building2 size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Operational Divisions & Public Portals</h4>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Customize section headlines, individual division titles, officers in charge, mandates, and facility locations.
            </p>
          </div>
        </div>
        {selectedDept && (
          <Link
            to={`/departments/${selectedDept.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm shrink-0"
          >
            <span>View Public Page</span>
            <ExternalLink size={12} />
          </Link>
        )}
      </div>

      {/* SECTION 1: OVERALL SECTION HEADERS & CONTROLS */}
      <Panel title="Section Headlines & Visibility">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="sec-eyebrow"
              label="Eyebrow Tagline"
              value={sectionEyebrow}
              onChange={(e) => setSectionEyebrow(e.target.value)}
              placeholder="e.g. ISRO ISTRAC COMMAND SECTORS"
            />

            <Input
              id="sec-title"
              label="Section Main Title"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="e.g. Operational Divisions & Facilities"
            />
          </div>

          <Textarea
            id="sec-subtitle"
            label="Section Description"
            rows={2}
            value={sectionSubtitle}
            onChange={(e) => setSectionSubtitle(e.target.value)}
            placeholder="Specialized engineering directorates processing satellite downlinks..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                showFileCount
                  ? "border-nominal/40 bg-nominal/[0.06]"
                  : "border-border-subtle bg-surface/50 text-text-dim"
              }`}
              onClick={() => setShowFileCount(!showFileCount)}
            >
              <div>
                <div className="text-xs font-semibold text-text-primary">Show Active Files Badge</div>
                <div className="text-[10px] text-text-dim mt-0.5">Displays file count on each card</div>
              </div>
              <input
                type="checkbox"
                checked={showFileCount}
                onChange={() => {}}
                className="h-4 w-4 accent-nominal pointer-events-none"
              />
            </div>

            <div
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                showLeadOfficer
                  ? "border-nominal/40 bg-nominal/[0.06]"
                  : "border-border-subtle bg-surface/50 text-text-dim"
              }`}
              onClick={() => setShowLeadOfficer(!showLeadOfficer)}
            >
              <div>
                <div className="text-xs font-semibold text-text-primary">Show Officer in Charge</div>
                <div className="text-[10px] text-text-dim mt-0.5">Displays division director name</div>
              </div>
              <input
                type="checkbox"
                checked={showLeadOfficer}
                onChange={() => {}}
                className="h-4 w-4 accent-nominal pointer-events-none"
              />
            </div>
          </div>
        </div>
      </Panel>

      {/* SECTION 2: INDIVIDUAL DIVISION CONTENT CUSTOMIZER */}
      <Panel title="Individual Division Card & Portal Content" meta="block:department_pages">
        <div className="space-y-5">
          {/* Department Selection Strip */}
          <div>
            <label className="col-label block mb-2">Select Division to Edit</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {departments.map((d) => {
                const isSelected = selectedDeptId === d.id
                const customD = allContent[d.id] || {}
                const title = customD.title || d.name
                const code = customD.code || d.code || "DIV"

                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDeptId(d.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-accent bg-accent/15 text-white shadow-md shadow-accent/10"
                        : "border-border-subtle bg-[#060c18] hover:border-border-default hover:bg-card-hover text-text-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="num font-bold text-xs text-accent-light">/{code}</span>
                      {isSelected && <CheckCircle2 size={12} className="text-nominal" />}
                    </div>
                    <div className="text-xs font-bold text-white truncate">{title}</div>
                    <div className="text-[10px] text-text-dim mt-0.5 num">{d.fileCount ?? 0} files</div>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedDept ? (
            <div className="space-y-4 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers size={13} className="text-accent-light" />
                  <span>Editing: {effectiveTitle}</span>
                </span>
                <span className="text-[10px] text-text-dim font-mono">
                  Default Lead: {selectedDept.pageLeadOfficer || "Director"}
                </span>
              </div>

              {/* Editable Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Input
                    id="dept-name"
                    label="Division Display Title"
                    value={effectiveTitle}
                    onChange={(e) => updateCurrent({ title: e.target.value })}
                    placeholder="e.g. Flight Dynamics Division (FDD)"
                  />
                </div>

                <div>
                  <Input
                    id="dept-code"
                    label="Division Code"
                    value={effectiveCode}
                    onChange={(e) => updateCurrent({ code: e.target.value })}
                    placeholder="e.g. FDD"
                    className="num font-bold"
                  />
                </div>
              </div>

              {/* Editable Officer, Role & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Input
                    id="dept-lead"
                    label="Officer in Charge / Division Lead"
                    value={effectiveLead}
                    onChange={(e) => updateCurrent({ labLead: e.target.value })}
                    placeholder="e.g. Dr. Ananya Ray"
                  />
                </div>

                <div>
                  <Input
                    id="dept-role"
                    label="Officer Designation / Role"
                    value={effectiveRole}
                    onChange={(e) => updateCurrent({ leadRole: e.target.value })}
                    placeholder="e.g. Lead Astrodynamics Specialist"
                  />
                </div>

                <div>
                  <Input
                    id="dept-location"
                    label="Facility & Lab Location"
                    value={effectiveLocation}
                    onChange={(e) => updateCurrent({ roomLocation: e.target.value })}
                    placeholder="e.g. MOX-2 Building, 2nd Floor, Bengaluru"
                  />
                </div>
              </div>

              {/* Editable Mandate Description */}
              <Textarea
                id="dept-mandate"
                label="Custom Mission Mandate / Scope Description"
                rows={3}
                value={effectiveMandate}
                onChange={(e) => updateCurrent({ customMandate: e.target.value })}
                placeholder="Enter detailed departmental mission scope and telemetry downlink processing..."
                hint="Appears on the public landing page card and the division's dedicated showcase portal."
              />

              {/* Live Preview Card */}
              <div className="space-y-2 pt-2">
                <span className="col-label block">Live Division Card Preview (Landing Page)</span>
                <div className="p-5 rounded-2xl border border-border-default bg-[#0b1220] space-y-3.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-accent/20 text-accent-light flex items-center justify-center font-bold text-xs border border-accent/30">
                        {effectiveCode || "DIV"}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {effectiveTitle}
                        </h4>
                        <span className="text-[10px] text-text-dim">
                          {effectiveLocation}
                        </span>
                      </div>
                    </div>
                    {showFileCount && (
                      <span className="num text-[10px] font-bold text-accent-light px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                        {selectedDept.fileCount ?? 0} Active Files
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                    {effectiveMandate}
                  </p>

                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-dim">
                    {showLeadOfficer && (
                      <div>
                        <span className="text-[9px] uppercase font-bold text-text-dim block">Officer in Charge</span>
                        <strong className="text-white text-xs">
                          {effectiveLead || "Division Director"}
                        </strong>
                      </div>
                    )}
                    <span className="text-xs font-bold text-accent-light flex items-center gap-1">
                      <span>View Details</span>
                      <ExternalLink size={12} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-text-dim">Loading divisions…</div>
          )}

          <SaveBar onSave={handleSave} isPending={updateBlock.isPending} />
        </div>
      </Panel>
    </div>
  )
}
