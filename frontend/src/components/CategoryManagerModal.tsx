import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Tag,
  Plus,
  Trash2,
  AlertTriangle,
  Ban,
  FileText,
  ExternalLink,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { Modal, Button, Input, Textarea } from '.'
import {
  useReportCategories,
  useCreateCategory,
  useDeleteCategory,
} from '../hooks/useReportPresets'
import {
  reportPresetsApi,
  type CategoryPreset,
  type CategoryRelatedFilesResult,
} from '../api/reportPresets.api'
import { useToastStore } from '../store/toastStore'
import { getErrorMessage } from '../api/client'

interface CategoryManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCategory?: (code: string) => void
}

export function CategoryManagerModal({
  isOpen,
  onClose,
  onSelectCategory,
}: CategoryManagerModalProps) {
  const addToast = useToastStore((s) => s.addToast)
  const { data: categories = [] } = useReportCategories()
  const createCategoryMutation = useCreateCategory()
  const deleteCategoryMutation = useDeleteCategory()

  // Tab: 'list' or 'new'
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Safety Deletion State
  const [deletingCategory, setDeletingCategory] = useState<CategoryPreset | null>(null)
  const [checkingFiles, setCheckingFiles] = useState(false)
  const [filesCheckResult, setFilesCheckResult] = useState<CategoryRelatedFilesResult | null>(null)
  const [deletingInProgress, setDeletingInProgress] = useState(false)

  // Handle Create New Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Category Name and Short Code are required',
        variant: 'warning',
      })
      return
    }

    setSaving(true)
    try {
      const created = await createCategoryMutation.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
      })
      addToast({
        title: 'Category Created',
        message: `Report category "${created.name}" (${created.code}) created successfully.`,
        variant: 'success',
      })
      setName('')
      setCode('')
      setDescription('')
      setShowAddForm(false)
      if (onSelectCategory) {
        onSelectCategory(created.code)
      }
    } catch (err: any) {
      addToast({
        title: 'Could Not Create Category',
        message: getErrorMessage(err, 'Could not save category preset. Please try again.'),
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // Open Safety Deletion Check
  const openDeleteCheck = async (cat: CategoryPreset) => {
    setDeletingCategory(cat)
    setCheckingFiles(true)
    setFilesCheckResult(null)

    try {
      const result = await reportPresetsApi.checkRelatedFiles(cat.id)
      setFilesCheckResult(result)
    } catch (err: any) {
      addToast({
        title: 'Dependency Check Failed',
        message: getErrorMessage(err, 'Could not verify category file dependencies.'),
        variant: 'error',
      })
      setDeletingCategory(null)
    } finally {
      setCheckingFiles(false)
    }
  }

  // Confirm Delete (Only permitted when 0 files exist)
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return

    if (filesCheckResult && filesCheckResult.count > 0) {
      addToast({
        title: 'Deletion Blocked',
        message: `Cannot delete "${deletingCategory.name}". Please delete all ${filesCheckResult.count} related file(s) manually first.`,
        variant: 'error',
      })
      return
    }

    setDeletingInProgress(true)
    try {
      await deleteCategoryMutation.mutateAsync(deletingCategory.id)
      addToast({
        title: 'Category Deleted',
        message: `Report category "${deletingCategory.name}" has been permanently removed.`,
        variant: 'success',
      })
      setDeletingCategory(null)
      setFilesCheckResult(null)
    } catch (err: any) {
      addToast({
        title: 'Deletion Failed',
        message: getErrorMessage(err, 'The category could not be deleted.'),
        variant: 'error',
      })
    } finally {
      setDeletingInProgress(false)
    }
  }

  const predefinedCategories = categories.filter((c) => c.isSystem)
  const customCategories = categories.filter((c) => !c.isSystem)

  return (
    <>
      {/* Primary Management Modal */}
      <Modal
        isOpen={isOpen && !deletingCategory}
        onClose={onClose}
        title="Manage Report Categories"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div>
              <p className="text-xs text-text-secondary">
                Report categories categorize datasets across mission ingest, filters, and division workspaces.
              </p>
            </div>
            <Button
              type="button"
              variant={showAddForm ? 'outline' : 'primary'}
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="shrink-0"
            >
              <Plus size={13} />
              <span>{showAddForm ? 'Close Form' : 'New Category'}</span>
            </Button>
          </div>

          {/* Add Category Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreateCategory}
              className="p-4 rounded-xl border border-accent/30 bg-accent/[0.04] space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-accent-light uppercase tracking-wider">
                <Tag size={13} />
                <span>Create New Custom Category</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="cat-name"
                  label="Category Name *"
                  placeholder="e.g. Thermal Telemetry Analysis"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!code) {
                      setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase())
                    }
                  }}
                  required
                />

                <Input
                  id="cat-code"
                  label="Category Code (Used in Filenames) *"
                  placeholder="e.g. THERMAL"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  hint="Uppercase code inserted into naming patterns"
                  required
                />
              </div>

              <Textarea
                id="cat-desc"
                label="Description (Optional)"
                rows={2}
                placeholder="Brief description of files grouped under this category…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-accent/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={saving}
                  className="shadow-sm shadow-accent/25"
                >
                  {saving ? 'Saving Category…' : 'Save Category Preset'}
                </Button>
              </div>
            </form>
          )}

          {/* Category Sections */}
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {/* 1. Predefined Categories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-dim">
                <span className="font-semibold text-text-secondary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers size={13} className="text-cyan-400" />
                  <span>Predefined System Categories ({predefinedCategories.length})</span>
                </span>
                <span className="text-[11px] text-text-dim">Built-in operational presets</span>
              </div>

              <div className="divide-y divide-border-subtle rounded-xl border border-border-default bg-card overflow-hidden">
                {predefinedCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-card-hover transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary text-xs">{cat.name}</span>
                        <code className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-400/30">
                          {cat.code}
                        </code>
                        <span className="rounded bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.2 text-[9px] font-bold text-cyan-300 uppercase">
                          Predefined
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-text-dim truncate max-w-md">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="num text-xs text-text-muted">
                        <strong className="text-text-primary font-mono">{cat.usageCount ?? 0}</strong> file(s)
                      </span>
                      <button
                        type="button"
                        onClick={() => openDeleteCheck(cat)}
                        className="p-1.5 rounded-lg border border-transparent text-text-dim hover:text-critical hover:bg-critical/10 hover:border-critical/30 transition-all cursor-pointer"
                        title="Delete category preset (checked for files)"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Custom Categories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-dim">
                <span className="font-semibold text-text-secondary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Tag size={13} className="text-accent-light" />
                  <span>Custom Category Options ({customCategories.length})</span>
                </span>
                <span className="text-[11px] text-text-dim">Admin-defined categories</span>
              </div>

              {customCategories.length > 0 ? (
                <div className="divide-y divide-border-subtle rounded-xl border border-border-default bg-card overflow-hidden">
                  {customCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-card-hover transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary text-xs">{cat.name}</span>
                          <code className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-accent-light border border-accent/30">
                            {cat.code}
                          </code>
                          <span className="rounded bg-accent/15 border border-accent/30 px-1.5 py-0.2 text-[9px] font-bold text-accent-light uppercase">
                            Custom
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-text-dim truncate max-w-md">
                            {cat.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="num text-xs text-text-muted">
                          <strong className="text-text-primary font-mono">{cat.usageCount ?? 0}</strong> file(s)
                        </span>
                        <button
                          type="button"
                          onClick={() => openDeleteCheck(cat)}
                          className="p-1.5 rounded-lg border border-transparent text-text-dim hover:text-critical hover:bg-critical/10 hover:border-critical/30 transition-all cursor-pointer"
                          title="Delete custom category preset"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border-subtle bg-card p-4 text-center">
                  <p className="text-xs text-text-dim italic">
                    No custom categories defined yet. Use "+ New Category" to create one.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-border-subtle">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Safety Deletion Modal (Same Concept as Satellite Hard Delete) */}
      <Modal
        isOpen={deletingCategory !== null}
        onClose={() => {
          if (!deletingInProgress) {
            setDeletingCategory(null)
            setFilesCheckResult(null)
          }
        }}
        title={`Delete Report Category — ${deletingCategory?.name || ''}`}
        size="md"
      >
        <div className="space-y-4">
          {checkingFiles ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
              <RefreshCw className="h-7 w-7 text-accent-light animate-spin" />
              <p className="text-xs font-semibold text-text-primary">
                Checking for active files associated with "{deletingCategory?.name}"…
              </p>
              <p className="text-[11px] text-text-dim">
                Scanning repository reports and datasets across divisions…
              </p>
            </div>
          ) : filesCheckResult && filesCheckResult.count > 0 ? (
            /* ============================================================
               ACTION BLOCKED: Files exist associated with category
               ============================================================ */
            <div className="space-y-4">
              <div className="rounded-xl border border-critical/40 bg-critical/10 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-critical/20 text-critical border border-critical/30">
                    <Ban size={20} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-critical">
                      Action Blocked: Associated Files Exist ({filesCheckResult.count})
                    </h4>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Cannot delete report category <strong className="text-text-primary">{deletingCategory?.name}</strong>{' '}
                      (<code className="num text-accent-light">{deletingCategory?.code}</code>).
                      There are currently <strong className="text-critical">{filesCheckResult.count}</strong> active file(s) associated with this category.
                    </p>
                    <div className="rounded-md border border-warning/30 bg-warning/10 p-2.5 mt-2">
                      <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Please delete all related files manually first before attempting to delete this category.</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample detected files */}
              {filesCheckResult.sampleFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="font-semibold text-text-secondary">Associated Files Detected:</span>
                    <span>Showing {filesCheckResult.sampleFiles.length} of {filesCheckResult.count}</span>
                  </div>
                  <div className="rounded-lg border border-border-default bg-surface divide-y divide-border-subtle max-h-48 overflow-y-auto">
                    {filesCheckResult.sampleFiles.map((file) => (
                      <div key={file.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex items-center gap-2">
                          <FileText size={14} className="shrink-0 text-text-dim" />
                          <div className="min-w-0">
                            <span className="font-mono text-text-primary truncate block">{file.name}</span>
                            {file.reportTitle && (
                              <span className="text-[10px] text-text-dim truncate block">{file.reportTitle}</span>
                            )}
                          </div>
                        </div>
                        {file.departmentCode && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold bg-accent/15 text-accent-light border border-accent/25">
                            {file.departmentCode}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action shortcut to File Repository */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border-default bg-surface gap-3">
                <span className="text-xs text-text-secondary">
                  Open file repository filtered to this category to delete files manually:
                </span>
                <Link
                  to={`/admin/files?category=${deletingCategory?.code}`}
                  onClick={() => {
                    setDeletingCategory(null)
                    onClose()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent-light hover:bg-accent hover:text-white transition-all shrink-0"
                >
                  <span>View Files in Repository</span>
                  <ExternalLink size={12} />
                </Link>
              </div>

              {/* Modal Footer with disabled / blocked delete button */}
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                <span className="text-[11px] text-text-dim">
                  Deletion is halted until all files are removed manually.
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setDeletingCategory(null)
                      setFilesCheckResult(null)
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    disabled
                    className="opacity-50 cursor-not-allowed"
                    title="All associated files must be deleted manually first"
                  >
                    <Ban size={14} />
                    <span>Deletion Blocked</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================
               ALLOW DELETION: 0 files associated
               ============================================================ */
            <div className="space-y-4">
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">Permanent Category Deletion</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Zero associated files were found for <strong className="text-white">{deletingCategory?.name}</strong>{' '}
                      (<code className="num text-accent-light">{deletingCategory?.code}</code>).
                      You can safely delete this report category preset from the database.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-critical/30 bg-critical/5 p-3 text-xs text-text-secondary space-y-1">
                <p className="font-semibold text-critical">⚠️ This action cannot be undone:</p>
                <ul className="list-disc list-inside text-[11px] text-text-dim space-y-0.5">
                  <li>The category will be permanently removed from presets.</li>
                  <li>It will no longer appear in report ingest forms or category filter options.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setDeletingCategory(null)
                    setFilesCheckResult(null)
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={deletingInProgress}
                  onClick={handleConfirmDelete}
                  className="shadow-lg shadow-critical/20"
                >
                  <Trash2 size={14} />
                  <span>{deletingInProgress ? 'Deleting Category…' : 'Confirm Delete'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
