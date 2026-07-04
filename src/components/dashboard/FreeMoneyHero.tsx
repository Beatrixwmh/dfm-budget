import { formatCurrency, formatDate, formatDateWithWeekday } from '../../utils/format';

interface Props {
  freeToSpend: number;
  nextIncomeDate: string | null;
  maxSplurge: number;
  dfmPerDay: number;
  totalBalance: number;
  pinchPointDate: string;
  isDeficit: boolean;
  /** How far the spendable pool is below the buffer right now (0 if above). */
  underwaterBy: number;
}

/**
 * The app's answer, front and center: how much of the balance is actually free
 * right now. The daily rate (DFM) is backend machinery — it only appears here
 * as small print explaining how fast the pool refills.
 */
export function FreeMoneyHero({
  freeToSpend,
  nextIncomeDate,
  maxSplurge,
  dfmPerDay,
  totalBalance,
  pinchPointDate,
  isDeficit,
  underwaterBy,
}: Props) {
  const empty = freeToSpend < 1;
  const numberColor = isDeficit ? 'text-danger' : empty ? 'text-warning' : 'text-success';
  const showSplurge = !isDeficit && maxSplurge > freeToSpend + 1;

  return (
    <div>
      <p className="text-sm text-text-secondary">Free to spend</p>
      <p className={`mt-1 text-[2.75rem] font-bold leading-none tabular-nums ${numberColor}`}>
        {formatCurrency(Math.max(0, freeToSpend))}
      </p>

      {isDeficit ? (
        <p className="mt-2 text-xs text-danger">
          {underwaterBy > 0
            ? `You're ${formatCurrency(underwaterBy)} below your buffer right now.`
            : `Overcommitted — even spending nothing, you'd breach your buffer${
                pinchPointDate ? ` around ${formatDate(pinchPointDate)}` : ' soon'
              }. Short about ${formatCurrency(Math.abs(dfmPerDay) * 30)}/month.`}
        </p>
      ) : (
        <p className="mt-2 text-xs text-text-muted">
          {nextIncomeDate
            ? `refills ${formatDateWithWeekday(nextIncomeDate)}`
            : 'no upcoming income scheduled'}
          {' · '}frees up ~{formatCurrency(Math.max(0, dfmPerDay))}/day
          {' · '}balance {formatCurrency(totalBalance)}
        </p>
      )}

      {showSplurge && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-text-secondary">
          Could splurge up to{' '}
          <span className="font-semibold tabular-nums text-text-primary">
            {formatCurrency(maxSplurge)}
          </span>{' '}
          today without missing a future bill — but it drains your cushion.
        </p>
      )}
    </div>
  );
}
