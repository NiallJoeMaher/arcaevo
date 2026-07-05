/**
 * en-IE — Irish English.
 *
 * Irish English shares UK/European spelling (centre, optimisation, whilst…),
 * so en-IE simply re-exports en-GB. If the brand ever needs an IE-only phrasing
 * (e.g. "GP" vs "doctor", local terminology), override it here with a spread:
 *
 *   const enIE: Messages = { ...enGB, footer: { ...enGB.footer, … } };
 *
 * Keeping it a thin re-export means en-GB stays the one place UK/EU copy lives.
 */

import enGB from "./en-GB";
import type { Messages } from "./en-US";

const enIE: Messages = enGB;

export default enIE;
