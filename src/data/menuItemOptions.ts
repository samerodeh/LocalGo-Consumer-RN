// ⚠️ STUB — NOT THE ORIGINAL FILE. The real menuItemOptions.ts was lost with the
// rest of this repo's partial restore, and only a truncated fragment of
// AL_TAIB_ITEM_OPTIONS survives in the Claude Code transcripts (cut off
// mid-array; CK_ITEM_OPTIONS is absent entirely). Rather than invent menu data,
// this exports the two records empty.
//
// Effect while this stub is in place: every menu item behaves as though it has
// no customization options. menu.ts looks options up by id
// (AL_TAIB_ITEM_OPTIONS[item.id]) and already handles a miss, so nothing
// crashes — the "choose your options" groups simply never appear.
//
// Replace with the real file when you find it. Everything else in the app is
// unaffected.
import type { MenuOptionGroup } from '../types';

export const AL_TAIB_ITEM_OPTIONS: Record<string, MenuOptionGroup[]> = {};

export const CK_ITEM_OPTIONS: Record<string, MenuOptionGroup[]> = {};
