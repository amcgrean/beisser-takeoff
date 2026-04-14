'use client';

import { useState, useEffect } from 'react';

/**
 * Reads the `beisser-branch` cookie (set by TopNav BranchSwitcher).
 * Returns '' if not set or not in a browser context.
 */
function readBranchCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)beisser-branch=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Initializes and manages the branch filter state for ERP module client components.
 *
 * - Non-admins are locked to their session branch (can't switch).
 * - Admins start with the TopNav BranchSwitcher value (beisser-branch cookie),
 *   falling back to '' (All Branches) if not set.
 * - SSR-safe: uses session branch as initial value to avoid hydration mismatches,
 *   then syncs to cookie after mount.
 *
 * Usage:
 *   const [branch, setBranch] = useBranchFilter(isAdmin, userBranch);
 */
export function useBranchFilter(
  isAdmin: boolean,
  userBranch: string | null
): [string, React.Dispatch<React.SetStateAction<string>>] {
  const [branch, setBranch] = useState<string>(isAdmin ? '' : (userBranch ?? ''));

  useEffect(() => {
    if (!isAdmin) return; // Non-admins are locked to their session branch
    const cookie = readBranchCookie();
    if (cookie !== undefined) {
      setBranch(cookie); // '' = All Branches, '20GR' etc = specific branch
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to sync with TopNav selection

  return [branch, setBranch];
}
