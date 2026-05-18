'use client';

interface StickySaveBarProps {
  /** When false the bar is hidden (e.g. no unsaved changes). */
  visible: boolean;
  /** Reverts the form to its last-saved values and stays on the page. */
  onCancel: () => void;
  /** Persists the form. */
  onSave: () => void;
  saving?: boolean;
  /** Disable Save (e.g. invalid form) while still showing the bar. */
  saveDisabled?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  cancelLabel?: string;
}

// The canonical button style used across the app's popups (CancelSubscription,
// LeaveCommunity, …). Reused here verbatim so the save bar matches them.
const BTN_BASE: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 400,
  borderRadius: '12px',
  padding: '0.375rem 1.25rem',
};

/**
 * Floating Save/Cancel bar — fixed, centred, 24px above the viewport bottom.
 * White pill, gray-3 stroke, 10px inner padding, light drop shadow.
 * Slides/fades in only while `visible` (the page decides "dirty").
 *
 * RTL note: site is Hebrew-RTL, so visual order is Cancel (right) → Save (left),
 * matching the order the course/manage pages already used.
 */
export default function StickySaveBar({
  visible,
  onCancel,
  onSave,
  saving = false,
  saveDisabled = false,
  saveLabel = 'שמור שינויים',
  savingLabel = 'שומר...',
  cancelLabel = 'ביטול',
}: StickySaveBarProps) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed left-1/2 z-40 -translate-x-1/2 transition-all duration-200 ease-out ${
        visible
          ? 'pointer-events-auto opacity-100 translate-y-0'
          : 'pointer-events-none opacity-0 translate-y-3'
      }`}
      style={{ bottom: 24 }}
    >
      <div
        className="flex items-center gap-3 rounded-xl border bg-white"
        style={{
          padding: 10,
          borderColor: 'var(--color-gray-3)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-white text-black border hover:bg-gray-50 transition disabled:opacity-50"
          style={{ ...BTN_BASE, borderColor: 'var(--color-black)' }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saveDisabled}
          className="bg-black text-white hover:opacity-90 transition disabled:opacity-50"
          style={BTN_BASE}
        >
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}
