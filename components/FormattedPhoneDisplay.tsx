"use client";

import { parsePhoneForDisplay } from "@/utils/phone";

interface FormattedPhoneDisplayProps {
  phone: string | null | undefined;
  /** Render as link (tel:) */
  asLink?: boolean;
  className?: string;
}

/**
 * Displays phone with country code in parentheses.
 * When user copies, they get the value WITHOUT parentheses (parens use user-select: none).
 */
export function FormattedPhoneDisplay({
  phone,
  asLink = false,
  className = "",
}: FormattedPhoneDisplayProps) {
  if (!phone || !phone.trim()) return null;

  const { countryCode, nationalPart, fullForCopy } = parsePhoneForDisplay(phone);
  const hasCountryCode = !!countryCode;

  const content = (
    <span className={className}>
      {hasCountryCode ? (
        <>
          <span className="select-none" aria-hidden="true">
            (
          </span>
          <span>{countryCode}</span>
          <span className="select-none" aria-hidden="true">
            )
          </span>
          {nationalPart && <span> {nationalPart}</span>}
        </>
      ) : (
        <span>{nationalPart}</span>
      )}
    </span>
  );

  if (asLink) {
    return (
      <a
        href={`tel:${fullForCopy}`}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        {content}
      </a>
    );
  }

  return content;
}
