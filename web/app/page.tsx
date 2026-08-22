"use client";

import { FormEvent, useState } from "react";

type Track = { title: string; artist: string | null; reason: string; source: string; bangerScore?: number; energy?: number; transitionReason?: string };
type Plan = {
  eventId: string;
    sections: { section: string; description: string; targetEnergy: number; tracks: Track[] }[];
  doNotPlay: { title: string; artist: string | null }[];
  guidance: { title: string; message: string; priority: string }[];
};

const eventTypes = [
  ["wedding", "Wedding"], ["birthday", "Birthday"], ["sweet-16-quinceanera", "Sweet 16 / Quinceanera"],
  ["graduation", "Graduation"], ["corporate", "Corporate"], ["school-college", "School / College"],
  ["club-bar", "Club / Bar"], ["private-party", "Private party"], ["anniversary", "Anniversary"],
  ["holiday-party", "Holiday party"], ["concert-festival", "Concert / Festival"], ["other", "Other"],
];

const initialForm = {
  eventName: "", eventDate: "", eventType: "birthday", guests: "", genres: "",
  mustPlayRaw: "", doNotPlayRaw: "", guestArrival: "", cocktailHour: "", dinner: "",
  dancingStarts: "", lastSong: "", ageRanges: "", culturalBackground: "",
};

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(name: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function generatePlan(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setPlan(null);
    try {
      const response = await fetch("/api/events", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventName: form.eventName, eventDate: form.eventDate, eventType: form.eventType,
          schedule: { guestArrival: form.guestArrival, cocktailHour: form.cocktailHour, dinner: form.dinner, dancingStarts: form.dancingStarts, lastSong: form.lastSong },
          audience: { ageRanges: form.ageRanges ? [form.ageRanges] : [], culturalBackground: form.culturalBackground },
          mustPlayRaw: form.mustPlayRaw, doNotPlayRaw: form.doNotPlayRaw,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The plan could not be generated.");
      setPlan(data.gamePlan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not connect to the DJ service.");
    } finally { setLoading(false); }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">DJ</span><span>Music Choice <b>Assist</b></span></div>
        <nav><a className="active" href="#create">Create event</a><a href="#plan">My plans</a><a href="#knowledge">Knowledge</a></nav>
        <div className="status"><i /> Engine online</div>
      </header>
      <section className="intro" id="create">
        <div><p className="eyebrow">EVENT BUILDER / 01</p><h1>Make the room<br /><em>remember.</em></h1><p className="lede">Shape the night around the people in it. Start with the details, then let real DJ set history fill the gaps.</p></div>
        <div className="intro-note"><span>01</span><p>Your requests are treated as anchors. Recommendations are supporting players, not replacements.</p></div>
      </section>
      <div className="workspace">
        <form className="form-panel" onSubmit={generatePlan}>
          <div className="panel-heading"><div><p className="eyebrow">THE BRIEF</p><h2>Tell us about the night</h2></div><span className="step">1 / 2</span></div>
          <div className="form-grid two"><label>Event name<input required value={form.eventName} onChange={(e) => update("eventName", e.target.value)} placeholder="Maria's 30th birthday" /></label><label>Event type<select value={form.eventType} onChange={(e) => update("eventType", e.target.value)}>{eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
          <div className="form-grid three"><label>Date<input required type="date" value={form.eventDate} onChange={(e) => update("eventDate", e.target.value)} /></label><label>Guest count<input type="number" min="1" value={form.guests} onChange={(e) => update("guests", e.target.value)} placeholder="150" /></label><label>Age range<input value={form.ageRanges} onChange={(e) => update("ageRanges", e.target.value)} placeholder="25-44" /></label></div>
          <label>Genres or cultural notes<input value={form.culturalBackground} onChange={(e) => update("culturalBackground", e.target.value)} placeholder="Hip-hop, R&B, Dominican and Puerto Rican family" /></label>
          <div className="section-label"><span>Requests</span><small>One song per line, or separate with commas</small></div>
          <div className="form-grid two"><label>Must play<textarea value={form.mustPlayRaw} onChange={(e) => update("mustPlayRaw", e.target.value)} placeholder={'Usher - Yeah!\nSeptember by Earth, Wind & Fire'} /></label><label>Do not play<textarea value={form.doNotPlayRaw} onChange={(e) => update("doNotPlayRaw", e.target.value)} placeholder="Songs or artists to avoid" /></label></div>
          <div className="section-label"><span>Timeline</span><small>Optional, but useful for pacing</small></div>
          <div className="form-grid three"><label>Arrival<input value={form.guestArrival} onChange={(e) => update("guestArrival", e.target.value)} placeholder="7:00 PM" /></label><label>Dinner<input value={form.dinner} onChange={(e) => update("dinner", e.target.value)} placeholder="8:00 PM" /></label><label>Dancing starts<input value={form.dancingStarts} onChange={(e) => update("dancingStarts", e.target.value)} placeholder="8:30 PM" /></label></div>
          <div className="form-footer"><p>Plan is generated from your brief and the DJ knowledge base.</p><button disabled={loading}>{loading ? "Building plan..." : "Generate DJ plan  →"}</button></div>
          {error && <p className="error">{error}</p>}
        </form>
        <aside className="side-panel"><div className="side-top"><p className="eyebrow">YOUR WORKSPACE</p><h3>One brief.<br /><em>Better nights.</em></h3></div><div className="metric"><strong>5</strong><span>plan moments<br />ready to shape</span></div><div className="side-copy">The engine weighs gig-log evidence, crowd recognition, energy, and transition history to explain every pick.</div><div className="legend"><span><i className="dot orange" />Customer anchor</span><span><i className="dot teal" />Knowledge pick</span></div></aside>
      </div>
      {plan && <section className="plan" id="plan"><div className="plan-header"><div><p className="eyebrow">GENERATED GAME PLAN / 02</p><h2>{form.eventName}</h2></div><button className="secondary" onClick={() => setPlan(null)}>← Edit brief</button></div><div className="plan-grid">{plan.sections.map((section) => <article className="plan-section" key={section.section}><div className="section-title"><span>{section.section.replaceAll("-", " ")}</span><small>{section.tracks.length} tracks</small></div><p>{section.description}</p>{section.tracks.length === 0 ? <div className="empty">No matching tracks yet.</div> : section.tracks.map((track) => <div className="track" key={`${track.artist}-${track.title}`}><div className={`track-badge ${track.source === "must-play" ? "anchor" : ""}`}>{track.source === "must-play" ? "★" : "♪"}</div><div><strong>{track.title}</strong><span>{track.artist ?? "Artist to confirm"}</span></div>{track.bangerScore !== undefined && <b className="score">{track.bangerScore}</b>}</div>)}</article>)}</div>{plan.doNotPlay.length > 0 && <div className="avoid"><strong>Keep off the floor</strong><span>{plan.doNotPlay.map((song) => `${song.artist ? `${song.artist} - ` : ""}${song.title}`).join("  ·  ")}</span></div>}</section>}
      {plan && <section className="plan" id="plan"><div className="plan-header"><div><p className="eyebrow">GENERATED GAME PLAN / 02</p><h2>{form.eventName}</h2></div><button className="secondary" onClick={() => setPlan(null)}>← Edit brief</button></div><div className="plan-grid">{plan.sections.map((section) => <article className="plan-section" key={section.section}><div className="section-title"><span>{section.section.replaceAll("-", " ")}</span><small>{section.tracks.length} tracks · energy {section.targetEnergy}/10</small></div><p>{section.description}</p>{section.tracks.length === 0 ? <div className="empty">No matching tracks yet.</div> : section.tracks.map((track) => <div className="track" key={`${track.artist}-${track.title}`}><div className={`track-badge ${track.source === "must-play" ? "anchor" : ""}`}>{track.source === "must-play" ? "★" : "♪"}</div><div><strong>{track.title}</strong><span>{track.artist ?? "Artist to confirm"}{track.energy !== undefined ? ` · ${track.energy}/10 energy` : ""}</span>{track.transitionReason && <small className="transition">{track.transitionReason}</small>}</div>{track.bangerScore !== undefined && <b className="score">{track.bangerScore}</b>}</div>)}</article>)}</div>{plan.doNotPlay.length > 0 && <div className="avoid"><strong>Keep off the floor</strong><span>{plan.doNotPlay.map((song) => `${song.artist ? `${song.artist} - ` : ""}${song.title}`).join("  ·  ")}</span></div>}</section>}
    </main>
  );
}