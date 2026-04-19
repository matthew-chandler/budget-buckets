import { bucketLabel } from '../i18n/buckets'
import { useI18n } from '../i18n/I18nProvider'
import type { BucketAllocation } from '../lib/types'
import { cssVars } from '../lib/format'

interface BucketGridProps {
  buckets: BucketAllocation[]
}

export function BucketGrid({ buckets }: BucketGridProps) {
  const { locale, t, formatCurrency, formatPercent } = useI18n()

  return (
    <div className="bucket-grid">
      {buckets.map((bucket, i) => {
        const isEmpty = bucket.amount === null || bucket.amount === 0
        return (
          <article
            key={bucket.key}
            className={`bucket-card ${isEmpty ? 'is-empty' : ''}`}
            style={cssVars({ bucketColor: bucket.color })}
          >
            <div className="bucket-card__head">
              <span className="bucket-card__key">
                No. {(i + 1).toString().padStart(2, '0')}
              </span>
              <span className="bucket-card__share">{formatPercent(bucket.share)}</span>
            </div>

            <h3 className="bucket-card__label">{bucketLabel(bucket.key, locale)}</h3>
            <div className="bucket-card__amount">{formatCurrency(bucket.amount, true)}</div>

            <p className="bucket-card__summary">
              {bucket.summary ?? t('bucketNoSummary')}
            </p>

            {bucket.rawCategories.length ? (
              <div className="bucket-card__tags">
                {bucket.rawCategories.slice(0, 4).map((cat) => (
                  <span key={cat} className="bucket-card__tag">
                    {cat}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
