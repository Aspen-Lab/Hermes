import type { EventSourceAdapter, EventSourceId } from "../types";
import { ccfddl } from "./ccfddl";
import { confstech } from "./confstech";
import { researchseminars } from "./researchseminars";
import { eventweb } from "./eventweb";

/**
 * All event source adapters. ccfddl/confs.tech/researchseminars are free and
 * keyless (Tier 0 stays useful with zero keys); eventweb turns on when a
 * Tavily/Brave key is present and is what covers non-CS disciplines beyond
 * researchseminars.
 */
export const eventSources: EventSourceAdapter[] = [
  ccfddl,
  confstech,
  researchseminars,
  eventweb,
];

export const eventSourceById: Record<EventSourceId, EventSourceAdapter> = {
  ccfddl,
  confstech,
  researchseminars,
  eventweb,
};
