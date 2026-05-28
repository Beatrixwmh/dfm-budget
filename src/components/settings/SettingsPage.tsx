import { useState, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../store/hooks';
import { CurrencyInput } from '../shared/CurrencyInput';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { todayString, formatDate } from '../../utils/format';
import { localStorageAdapter } from '../../persistence/storage';

export function SettingsContent() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = localStorageAdapter.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dfm-budget-backup-${todayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImport(reader.result as string);
      setImportConfirm(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = () => {
    if (pendingImport) {
      try {
        const imported = localStorageAdapter.importJson(pendingImport);
        dispatch({ type: 'IMPORT_STATE', payload: imported });
      } catch (err) {
        alert('Invalid backup file. Please check the file and try again.');
      }
    }
    setImportConfirm(false);
    setPendingImport(null);
  };

  const handleAddHoliday = () => {
    if (!holidayDate || !holidayName.trim()) return;
    dispatch({ type: 'ADD_HOLIDAY', payload: { date: holidayDate, name: holidayName.trim() } });
    setHolidayDate('');
    setHolidayName('');
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h2 className="mb-6 text-2xl font-bold">Settings</h2>

      {/* Balance */}
      <section className="mb-8">
        <h3 className="mb-3 text-lg font-semibold">Current Balance</h3>
        <CurrencyInput
          value={state.balance.currentBalance}
          onChange={val => dispatch({
            type: 'SET_BALANCE',
            payload: { currentBalance: val, lastUpdated: todayString() },
          })}
        />
        <p className="mt-1 text-xs text-text-muted">
          Last updated: {formatDate(state.balance.lastUpdated)}
        </p>
      </section>

      {/* Buffer */}
      <section className="mb-8">
        <h3 className="mb-1 text-lg font-semibold">Safety Buffer</h3>
        <p className="mb-3 text-sm text-text-secondary">
          Minimum balance you want to keep. DFM will never let you drop below this.
        </p>
        <CurrencyInput
          value={state.buffer}
          onChange={val => dispatch({ type: 'SET_BUFFER', payload: val })}
        />
      </section>

      {/* Custom Holidays */}
      <section className="mb-8">
        <h3 className="mb-3 text-lg font-semibold">Custom Holidays</h3>
        <p className="mb-3 text-sm text-text-secondary">
          US federal holidays are built in. Add any additional days off here.
        </p>

        {state.customHolidays.length > 0 && (
          <div className="mb-3 flex flex-col gap-1.5">
            {state.customHolidays.map(h => (
              <div key={h.date} className="flex items-center justify-between rounded-lg bg-surface-raised px-4 py-2.5">
                <span className="text-sm">{h.name} — {formatDate(h.date)}</span>
                <button
                  onClick={() => dispatch({ type: 'DELETE_HOLIDAY', payload: h.date })}
                  className="text-sm text-text-muted hover:text-danger"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="date"
            value={holidayDate}
            onChange={e => setHolidayDate(e.target.value)}
            className="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-text-primary"
          />
          <input
            type="text"
            value={holidayName}
            onChange={e => setHolidayName(e.target.value)}
            placeholder="Holiday name"
            className="flex-1 rounded-lg border border-border bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            onClick={handleAddHoliday}
            disabled={!holidayDate || !holidayName.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </section>

      {/* Backup */}
      <section className="mb-8">
        <h3 className="mb-3 text-lg font-semibold">Backup &amp; Restore</h3>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 rounded-lg bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-overlay"
          >
            Export Data
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded-lg bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-overlay"
          >
            Import Data
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
        </div>
      </section>

      <ConfirmDialog
        open={importConfirm}
        title="Import Data"
        message="This will replace all your current data. Are you sure?"
        confirmLabel="Import"
        onConfirm={handleImportConfirm}
        onCancel={() => { setImportConfirm(false); setPendingImport(null); }}
      />
    </div>
  );
}
