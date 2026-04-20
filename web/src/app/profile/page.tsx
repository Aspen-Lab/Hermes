"use client";

import { useState, useEffect } from "react";
import { useProfileStore } from "@/store/profile";
import { careerStages, industryPreferences, venueOptions } from "@/types";

export default function ProfilePage() {
  const {
    profile, updateDisplayName, updateTopics, updateVenues,
    updateCareerStage, updateIndustryPreference, updateLocations,
    updateMethods, logOut,
  } = useProfileStore();

  const [name, setName] = useState(profile.displayName);
  const [topics, setTopics] = useState(profile.researchTopics.join(", "));
  const [locations, setLocations] = useState(profile.locationPreferences.join(", "));
  const [methods, setMethods] = useState(profile.preferredMethods.join(", "));
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    setName(profile.displayName);
    setTopics(profile.researchTopics.join(", "));
    setLocations(profile.locationPreferences.join(", "));
    setMethods(profile.preferredMethods.join(", "));
  }, [profile]);

  const parseList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <article className="mx-auto max-w-[720px] lg:max-w-[960px] px-6 py-12">
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-heading tracking-tight">Profile</h1>
        <p className="text-text-muted mt-2 text-[15px]">
          Your research context powers Hermes recommendations.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-5 lg:gap-12 mt-10">
      {/* Fields rendered like Obsidian metadata / properties */}
      <section className="lg:col-span-3 space-y-6">
        <Field label="Display name">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); updateDisplayName(e.target.value); }}
            className="w-full bg-transparent text-text placeholder-text-faint outline-none"
            placeholder="Your name"
          />
        </Field>

        <Field label="Research topics" hint="comma-separated">
          <textarea
            value={topics}
            onChange={(e) => { setTopics(e.target.value); updateTopics(parseList(e.target.value)); }}
            rows={2}
            className="w-full bg-transparent text-text placeholder-text-faint outline-none resize-none"
            placeholder="NLP, reinforcement learning, HCI"
          />
        </Field>

        <Field label="Preferred venue">
          <select
            value={profile.preferredVenues[0] || "No preference"}
            onChange={(e) => updateVenues(e.target.value === "No preference" ? [] : [e.target.value])}
            className="w-full bg-transparent text-text outline-none cursor-pointer appearance-none"
          >
            {venueOptions.map((v) => (
              <option key={v} value={v} className="bg-bg-secondary text-text">{v}</option>
            ))}
          </select>
        </Field>

        <Field label="Career stage">
          <select
            value={profile.careerStage}
            onChange={(e) => updateCareerStage(e.target.value as typeof profile.careerStage)}
            className="w-full bg-transparent text-text outline-none cursor-pointer appearance-none"
          >
            {careerStages.map((s) => (
              <option key={s} value={s} className="bg-bg-secondary text-text">{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Industry vs academia">
          <select
            value={profile.industryVsAcademia}
            onChange={(e) => updateIndustryPreference(e.target.value as typeof profile.industryVsAcademia)}
            className="w-full bg-transparent text-text outline-none cursor-pointer appearance-none"
          >
            {industryPreferences.map((p) => (
              <option key={p} value={p} className="bg-bg-secondary text-text">
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Location preferences" hint="comma-separated">
          <input
            type="text"
            value={locations}
            onChange={(e) => { setLocations(e.target.value); updateLocations(parseList(e.target.value)); }}
            className="w-full bg-transparent text-text placeholder-text-faint outline-none"
            placeholder="Remote, Bay Area, Europe"
          />
        </Field>

        <Field label="Preferred methods" hint="comma-separated">
          <input
            type="text"
            value={methods}
            onChange={(e) => { setMethods(e.target.value); updateMethods(parseList(e.target.value)); }}
            className="w-full bg-transparent text-text placeholder-text-faint outline-none"
            placeholder="RL, diffusion models, NLP"
          />
        </Field>
      </section>

      {/* Agent context — like Obsidian frontmatter block */}
      <section className="mt-12 lg:mt-0 lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-xl font-semibold text-heading mb-4 pb-1 border-b border-border">
          Agent Context
        </h2>
        <div className="bg-surface/50 rounded-lg p-5 font-mono text-sm leading-loose">
          <div className="text-text-faint">---</div>
          <PropLine k="stage" v={profile.careerStage} />
          <PropLine k="goal" v={profile.industryVsAcademia} />
          <PropLine k="topics" v={profile.researchTopics.length > 0 ? `[${profile.researchTopics.join(", ")}]` : "[]"} />
          <PropLine k="venues" v={profile.preferredVenues.length > 0 ? `[${profile.preferredVenues.join(", ")}]` : "[]"} />
          <PropLine k="methods" v={profile.preferredMethods.length > 0 ? `[${profile.preferredMethods.join(", ")}]` : "[]"} />
          <PropLine k="locations" v={profile.locationPreferences.length > 0 ? `[${profile.locationPreferences.join(", ")}]` : "[]"} />
          <div className="text-text-faint">---</div>
        </div>
      </section>
      </div>

      {/* Danger zone */}
      <section className="mt-12 pt-4 border-t border-border">
        {!showLogout ? (
          <button
            onClick={() => setShowLogout(true)}
            className="font-mono text-xs text-text-faint hover:text-red transition-colors"
          >
            Reset profile
          </button>
        ) : (
          <div className="font-mono text-xs">
            <p className="text-text-muted mb-2">This resets all settings to defaults.</p>
            <button onClick={() => { logOut(); setShowLogout(false); }} className="text-red hover:text-red/80 mr-4">
              Confirm reset
            </button>
            <button onClick={() => setShowLogout(false)} className="text-text-faint hover:text-text-muted">
              Cancel
            </button>
          </div>
        )}
      </section>
    </article>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-sm font-semibold text-heading">{label}</label>
        {hint && <span className="font-mono text-xs text-text-faint">{hint}</span>}
      </div>
      <div className="border-b border-border pb-2">{children}</div>
    </div>
  );
}

function PropLine({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-link">{k}</span>
      <span className="text-text-faint">: </span>
      <span className="text-tag">{v}</span>
    </div>
  );
}
