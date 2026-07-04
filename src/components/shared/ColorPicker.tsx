// Pastel palette — same hues as before, desaturated for a softer, low-glare look.
export const PRESET_COLORS = [
  '#d98f8f', '#e0a877', '#e0b074', '#d4be7e',
  '#a9c97e', '#6dbf9c', '#6fb3ac', '#7bb4c4',
  '#7d9fd4', '#8b80cc', '#a394d6', '#b596d6',
  '#c891d4', '#d691b0', '#d98fa0', '#969cb0',
];

interface Props {
  value: string;
  onChange: (color: string) => void;
  /** Colors already used by other categories — shown disabled. */
  taken?: string[];
}

export function ColorPicker({ value, onChange, taken = [] }: Props) {
  const takenSet = new Set(taken.map(c => c.toLowerCase()));
  return (
    <div>
      <label className="mb-1.5 block text-sm text-text-secondary">Color</label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map(color => {
          const isSelected = value.toLowerCase() === color.toLowerCase();
          const isTaken = !isSelected && takenSet.has(color.toLowerCase());
          return (
            <button
              key={color}
              type="button"
              disabled={isTaken}
              onClick={() => onChange(color)}
              title={isTaken ? 'Already used by another category' : undefined}
              className={`relative h-8 w-8 rounded-full transition-transform ${
                isTaken
                  ? 'cursor-not-allowed opacity-25'
                  : isSelected
                    ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-surface-raised'
                    : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            >
              {isTaken && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black/60">
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
