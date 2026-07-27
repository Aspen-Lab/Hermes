import { describe, expect, it } from "vitest";
import { ccfConfToRawItem } from "@/lib/events/sources/ccfddl";
import { scoredEventToEvent } from "@/lib/events/mapper";
import { jsearchJobToRawItem } from "@/lib/jobs/sources/jsearch";
import { scoredJobToJob } from "@/lib/jobs/mapper";

describe("structured opportunity place flow", () => {
  it("keeps Chicago and online status for a hybrid event through mapping", () => {
    const raw = ccfConfToRawItem(
      {
        title: "Solid-State Battery Summit",
        description: "Battery materials and solid electrolytes",
        confs: [
          {
            year: 2026,
            id: "ssb-2026",
            link: "https://example.com/solid-state-battery-summit",
            date: "August 11-12, 2026",
            place: "Chicago, IL + Virtual",
          },
        ],
      },
      Date.UTC(2026, 0, 1),
    );

    expect(raw).not.toBeNull();
    expect(raw).toMatchObject({
      place: {
        city: "Chicago",
        region: "IL",
        country: "United States",
      },
      isOnline: true,
    });

    const mapped = scoredEventToEvent({
      ...raw!,
      score: 0.88,
      matchedKeywords: ["solid-state battery"],
      relevanceReason: "Matches solid-state battery",
    });
    expect(mapped.place?.city).toBe("Chicago");
    expect(mapped.place?.region).toBe("IL");
    expect(mapped.isOnline).toBe(true);
  });

  it("keeps structured location and remote status for a job through mapping", () => {
    const raw = jsearchJobToRawItem({
      job_id: "job-42",
      job_title: "Battery Research Scientist",
      employer_name: "Example Lab",
      job_city: "Chicago",
      job_state: "IL",
      job_country: "United States",
      job_is_remote: true,
      job_description: "Research solid-state battery materials.",
      job_apply_link: "https://example.com/jobs/42",
      job_highlights: { Qualifications: ["Electrochemistry"] },
    });

    expect(raw).not.toBeNull();
    expect(raw).toMatchObject({
      place: {
        city: "Chicago",
        region: "IL",
        country: "United States",
      },
      isRemote: true,
    });

    const mapped = scoredJobToJob({
      ...raw!,
      score: 0.82,
      matchedKeywords: ["battery materials"],
      matchReason: "Matches battery materials",
    });
    expect(mapped.place).toEqual({
      city: "Chicago",
      region: "IL",
      country: "United States",
    });
    expect(mapped.isRemote).toBe(true);
  });
});
