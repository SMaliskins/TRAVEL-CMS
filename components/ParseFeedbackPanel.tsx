'use client';

import React, { useState } from 'react';
import { MessageSquareWarning, Send, Check, X } from 'lucide-react';

/**
 * ParseFeedbackPanel — inline correction panel for AI-parsed fields.
 *
 * Shows below a parsed result. User can:
 * 1. See which fields were parsed (green) vs missing (red) vs corrected (amber)
 * 2. Write what's wrong in a text field
 * 3. Submit corrections → saved to parse_feedback table
 * 4. After a correction on a field → auto-creates a parse_rule when patterns match (see parse-feedback API)
 *
 * Usage:
 *   <ParseFeedbackPanel
 *     documentType="package_tour"
 *     detectedOperator="Novatours"
 *     corrections={[{ field: "mealPlan", oldValue: "Half Board", newValue: "HB" }]}
 *     onSubmit={() => toast("Thanks for the feedback!")}
 *   />
 */

interface Correction {
  field: string;
  oldValue?: string;
  newValue?: string;
}

interface Props {
  documentType: string;
  detectedOperator?: string;
  corrections: Correction[];
  onSubmit?: () => void;
  className?: string;
}

export default function ParseFeedbackPanel({
  documentType,
  detectedOperator,
  corrections,
  onSubmit,
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const hasCorrections = corrections.length > 0;

  const handleSubmit = async () => {
    if (!hasCorrections && !comment.trim()) return;

    setSending(true);
    setError('');

    try {
      const feedbackCorrections = corrections.map(c => ({
        field_name: c.field,
        old_value: c.oldValue || null,
        new_value: c.newValue || null,
        feedback_type: 'correction',
        comment: comment.trim() || null,
      }));

      // If only comment, no field corrections — send as general feedback
      if (feedbackCorrections.length === 0 && comment.trim()) {
        feedbackCorrections.push({
          field_name: '_general',
          old_value: null,
          new_value: null,
          feedback_type: 'other',
          comment: comment.trim(),
        });
      }

      const res = await fetch('/api/ai/parse-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: documentType,
          detected_operator: detectedOperator || null,
          corrections: feedbackCorrections,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSent(true);
      setComment('');
      onSubmit?.();

      // Auto-close after 3 seconds
      setTimeout(() => {
        setSent(false);
        setIsOpen(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting feedback');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-600 py-2 ${className || ''}`}>
        <Check size={16} />
        <span>Thanks! Your correction was saved and will be used to improve future parsing.</span>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-600 transition-colors py-1 ${className || ''}`}
      >
        <MessageSquareWarning size={14} />
        <span>{hasCorrections ? `Submit ${corrections.length} correction${corrections.length === 1 ? "" : "s"}` : "Report a parse error"}</span>
      </button>
    );
  }

  return (
    <div className={`border border-amber-200 bg-amber-50/50 rounded-lg p-3 space-y-2 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
          <MessageSquareWarning size={16} />
          Parse feedback
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      {hasCorrections && (
        <div className="text-xs text-amber-700 space-y-1">
          {corrections.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="font-medium">{c.field}:</span>
              {c.oldValue && (
                <span className="line-through text-red-500">{c.oldValue}</span>
              )}
              {c.oldValue && c.newValue && <span>→</span>}
              {c.newValue && (
                <span className="text-green-700 font-medium">{c.newValue}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="What went wrong? (optional)"
          className="flex-1 text-sm border border-amber-300 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
          disabled={sending}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending || (!hasCorrections && !comment.trim())}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={14} />
          {sending ? "..." : "Send"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
