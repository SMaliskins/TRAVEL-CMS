"use client";

import BackLink from "./BackLink";

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  leftContent?: React.ReactNode;
  actions?: React.ReactNode;
  /** Extra badges/chips (e.g. "Unsaved", "Filtered") */
  badges?: React.ReactNode;
}

/**
 * Unified page header: [Back?] | [Title] | [Actions]
 * - Back: left, uses router.back()
 * - Title + subtitle: left/center
 * - Actions: right, use btn-primary / btn-secondary
 */
export default function PageHeader({
  title = "",
  subtitle,
  back = false,
  leftContent,
  actions,
  badges,
}: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {back && (
            <BackLink label="← Back" className="btn-back shrink-0" />
          )}
          {leftContent ?? (
            <div className="min-w-0">
              {title && <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>}
              {subtitle && (
                <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          )}
          {badges}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
