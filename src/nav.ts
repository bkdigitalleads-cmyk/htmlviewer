/**
 * What happens when something in a previewed page asks the web view to go
 * somewhere. Pure, checked by `npm test`.
 *
 * The app does not browse the web. A tapped web link opens in the phone's
 * browser; a tapped link to another file in the same folder opens that
 * file in the viewer; mail and phone links go to the system. A page can
 * never move itself (redirects, scripts, forms) to anything but its own
 * anchors, and nothing outside the file's folder loads.
 */
import { kindOf } from './filetypes.ts';

export type NavDecision =
  | { action: 'allow' }
  | { action: 'browser'; url: string }
  | { action: 'system'; url: string }
  | { action: 'sibling'; path: string }
  | { action: 'block' };

export interface NavRequest {
  url: string;
  /** iOS: click, formsubmit, backforward, reload, formresubmit, other. A new-window request counts as click. */
  navigationType?: string;
  /** False for a frame inside the page. */
  isTopFrame?: boolean;
}

export interface NavContext {
  /** The page copy the web view loaded (file://.../.hv-view-3.html). */
  pageUrl: string;
  /** The file's folder (file://.../library/abc/), ending in "/". */
  folderUrl: string;
  /** Web content is on for this file. */
  remote: boolean;
}

function filePath(url: string): string | null {
  if (!/^file:/i.test(url)) return null;
  const noFrag = url.split('#')[0].split('?')[0];
  try {
    return decodeURIComponent(noFrag.replace(/^file:\/\//i, ''));
  } catch {
    return noFrag.replace(/^file:\/\//i, '');
  }
}

export function classifyNav(req: NavRequest, ctx: NavContext): NavDecision {
  const url = (req.url ?? '').trim();
  const top = req.isTopFrame !== false;
  const click = req.navigationType === 'click';
  if (url === 'about:blank' || url === 'about:srcdoc') return { action: 'allow' };
  const scheme = (/^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1] ?? '').toLowerCase();

  if (scheme === 'file') {
    const path = filePath(url);
    const page = filePath(ctx.pageUrl);
    const folder = filePath(ctx.folderUrl);
    if (!path || !page || !folder) return { action: 'block' };
    const dir = folder.endsWith('/') ? folder : `${folder}/`;
    if (!path.startsWith(dir) || path.split('/').includes('..')) return { action: 'block' };
    if (path === page) return { action: 'allow' };
    if (!top) return { action: 'allow' };
    const rel = path.slice(dir.length);
    if (click && kindOf(rel) && !rel.split('/').some((p) => p.startsWith('.hv-'))) return { action: 'sibling', path: rel };
    return { action: 'block' };
  }

  if (scheme === 'http' || scheme === 'https') {
    if (top) return click ? { action: 'browser', url } : { action: 'block' };
    return ctx.remote ? { action: 'allow' } : { action: 'block' };
  }

  if (scheme === 'mailto' || scheme === 'tel' || scheme === 'sms') {
    return top && click ? { action: 'system', url } : { action: 'block' };
  }

  return { action: 'block' };
}
