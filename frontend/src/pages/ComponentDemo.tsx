import { useState } from 'react'

import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Table,
  Textarea,
} from '../components'

interface Row {
  id: number
  name: string
  status: string
}

const sampleData: Row[] = [
  {
    id: 1,
    name: 'Engineering',
    status: 'Active',
  },
  {
    id: 2,
    name: 'HR',
    status: 'Active',
  },
]

const TONES = [
  { name: 'accent', className: 'bg-accent' },
  { name: 'nominal', className: 'bg-nominal' },
  { name: 'warning', className: 'bg-warning' },
  { name: 'critical', className: 'bg-critical' },
  { name: 'special', className: 'bg-special' },
]

const PLANES = [
  { name: 'page', className: 'bg-page' },
  { name: 'surface', className: 'bg-surface' },
  { name: 'card', className: 'bg-card' },
  { name: 'card-hover', className: 'bg-card-hover' },
]

export function ComponentDemo() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="shell space-y-6 py-8">
      <PageHeader
        eyebrow="Reference"
        title="Design system"
        description="Specimen sheet for the shared primitives. Machine values are set in mono; everything a person wrote stays in Lato."
        meta="internal"
      />

      {/* Type */}
      <Panel title="Type" meta="Lato 300 / 400 / 700 · DejaVu Sans Mono">
        <div className="space-y-5">
          <div>
            <p className="col-label">Display</p>

            <p className="display mt-2 text-4xl text-text-primary">
              Spacecraft operations
            </p>
          </div>

          <div className="border-t border-border-subtle pt-4">
            <p className="col-label">Body</p>

            <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
              Set in Lato regular. Long-form explanation, field help and page
              descriptions all sit at this size so a page never has more than
              two reading weights.
            </p>
          </div>

          <div className="border-t border-border-subtle pt-4">
            <p className="col-label">Machine values</p>

            <p className="num mt-2 text-[13px] text-text-secondary">
              2026-08-21 14:02:57Z · 524,288,000 B · v14 · ISTRAC-BLR-MOX
            </p>
          </div>
        </div>
      </Panel>

      {/* Planes and tones */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Planes" meta={`${PLANES.length}`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLANES.map((plane) => (
              <div key={plane.name}>
                <div
                  className={`h-12 rounded-md border border-border-subtle ${plane.className}`}
                />

                <p className="num mt-1.5 text-[10px] text-text-dim">
                  {plane.name}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Tones" meta={`${TONES.length}`}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {TONES.map((tone) => (
              <div key={tone.name}>
                <div className={`h-12 rounded-md ${tone.className}`} />

                <p className="num mt-1.5 text-[10px] text-text-dim">
                  {tone.name}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Buttons */}
      <Panel title="Buttons" meta="5 variants · 3 sizes">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">
              Primary
            </Button>

            <Button variant="secondary">
              Secondary
            </Button>

            <Button variant="outline">
              Outline
            </Button>

            <Button variant="danger">
              Danger
            </Button>

            <Button variant="ghost">
              Ghost
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
            <Button variant="outline" size="sm">
              Small
            </Button>

            <Button variant="outline" size="md">
              Medium
            </Button>

            <Button variant="outline" size="lg">
              Large
            </Button>

            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </div>
      </Panel>

      {/* Badges */}
      <Panel title="Badges" meta="5 variants">
        <div className="flex flex-wrap gap-2">
          <Badge variant="nominal">
            Active
          </Badge>

          <Badge variant="warning">
            Pending
          </Badge>

          <Badge variant="critical">
            Rejected
          </Badge>

          <Badge variant="special">
            Info
          </Badge>

          <Badge variant="neutral">
            Neutral
          </Badge>
        </div>
      </Panel>

      {/* Form controls */}
      <Panel title="Form controls">
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="demo-email"
            label="Email"
            type="email"
            placeholder="you@istrac.local"
          />

          <Input
            id="demo-password"
            label="Password"
            type="password"
            error="Password is too short"
          />

          <Select id="demo-department" label="Department" defaultValue="ops">
            <option value="ops">Operations</option>
            <option value="eng">Engineering</option>
          </Select>

          <Input
            id="demo-id"
            label="Employee ID"
            defaultValue="ISTRAC-04821"
            className="num"
            hint="Machine value — set in mono."
          />

          <div className="sm:col-span-2">
            <Textarea
              id="demo-notes"
              label="Notes"
              rows={3}
              placeholder="Free text…"
            />
          </div>
        </div>
      </Panel>

      {/* Containers */}
      <Panel title="Containers">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card variant="default">
            <p className="text-sm text-text-primary">
              Default card
            </p>

            <p className="mt-1 text-[12px] text-text-dim">
              Static content plate.
            </p>
          </Card>

          <Card variant="interactive">
            <p className="text-sm text-text-primary">
              Interactive card
            </p>

            <p className="mt-1 text-[12px] text-text-dim">
              Brightens its edge on hover.
            </p>
          </Card>
        </div>
      </Panel>

      {/* Table */}
      <Panel title="Table" meta={`${sampleData.length} rows`} flush>
        <Table
          columns={[
            {
              key: 'name',
              header: 'Department',
            },
            {
              key: 'id',
              header: 'ID',
              numeric: true,
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <Badge variant="nominal">
                  {row.status}
                </Badge>
              ),
            },
          ]}
          data={sampleData}
        />
      </Panel>

      {/* Avatars + modal */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Avatars" meta="sm · md · lg">
          <div className="flex items-center gap-4">
            <Avatar name="Ayan Sharma" size="sm" />

            <Avatar name="Ayan Sharma" />

            <Avatar
              name="Jane Doe"
              shape="square"
              size="lg"
            />
          </div>
        </Panel>

        <Panel title="Overlay">
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>

          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Demo modal"
          >
            <p className="text-sm leading-6 text-text-secondary">
              Modal content goes here. The panel sits on a dimmed page so the
              context underneath stays readable.
            </p>
          </Modal>
        </Panel>
      </div>
    </div>
  )
}
