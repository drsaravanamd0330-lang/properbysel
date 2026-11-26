"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ADVERTISER_TYPES, ADVERTISER_LABEL, TRANSACTION_TYPES, PROPERTY_CATEGORIES, CATEGORY_LABEL, CATEGORY_GROUP,
  AMENITIES, AREA_UNITS, AREA_UNIT_LABEL, formatINR, rupeesToPaise, type PropertyCategory,
} from "@pbs/domain";
import type { ListingDraftInput } from "@pbs/validation";
import { ApiError, type OwnerListing, type City, type Locality } from "@pbs/api-client";
import { api } from "@/lib/client-api";
import { AMENITY_LABEL, statusLabel } from "@/lib/format";

const STEPS = ["Who & what", "Property type", "Location", "Details", "Price", "Photos", "Contact", "Review"] as const;
type Draft = ListingDraftInput & { attributes: Record<string, unknown> };
type SaveState = "idle" | "saving" | "saved" | "error" | "offline";

export function Wizard({ id }: { id: string }) {
  const [listing, setListing] = useState<OwnerListing | null>(null);
  const [draft, setDraft] = useState<Draft>({ attributes: {} });
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<City[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [save, setSave] = useState<SaveState>("idle");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const pending = useRef<Partial<Draft>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([api.listings.get(id), api.geo.cities()]).then(([l, c]) => {
      setListing(l); setCities(c.items); setStep(Math.min(l.wizardStep || 1, 8));
      setDraft({
        advertiserType: l.advertiserType ?? undefined, transaction: l.transaction ?? undefined, category: l.category ?? undefined,
        title: l.title ?? "", description: l.description ?? "", cityId: l.cityId ?? undefined, localityId: l.localityId ?? undefined,
        address: l.address ?? "", postcode: l.postcode ?? "", landmark: l.landmark ?? "", attributes: (l.attributes ?? {}) as Record<string, unknown>,
        amenities: l.amenities as Draft["amenities"], pricePaise: l.pricePaise ?? undefined, rentPaise: l.rentPaise ?? undefined, leasePaise: l.leasePaise ?? undefined,
        depositPaise: l.depositPaise ?? undefined, maintenancePaise: l.maintenancePaise ?? undefined, negotiable: l.negotiable, brokerageDisclosure: l.brokerageDisclosure ?? "",
        availableFrom: l.availableFrom ? new Date(l.availableFrom) : undefined, showPhone: l.showPhone, contactConsent: l.contactConsent, investmentSuitable: l.investmentSuitable,
      });
    }).catch((e) => setLoadErr(e instanceof ApiError && e.status === 401 ? "login" : e instanceof ApiError ? e.message : "Could not load this listing"));
  }, [id]);

  const citySlug = cities.find((c) => c.id === draft.cityId)?.slug;
  useEffect(() => { if (citySlug) api.geo.localities(citySlug).then((r) => setLocalities(r.items)).catch(() => setLocalities([])); }, [citySlug]);

  const flush = useCallback(async () => {
    const body = pending.current; pending.current = {};
    if (!Object.keys(body).length) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { pending.current = { ...body, ...pending.current }; setSave("offline"); return; }
    setSave("saving");
    try { const l = await api.listings.save(id, body); setListing(l); setSave("saved"); }
    catch (e) {
      pending.current = { ...body, ...pending.current };
      setSave(e instanceof ApiError && e.status === 0 ? "offline" : "error");
      if (e instanceof ApiError && e.status === 400) setIssues(e.fieldErrors);
    }
  }, [id]);
  useEffect(() => { const on = () => flush(); window.addEventListener("online", on); return () => window.removeEventListener("online", on); }, [flush]);

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    pending.current = { ...pending.current, ...patch };
    setSave("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }
  const setAttr = (k: string, v: unknown) => update({ attributes: { ...draft.attributes, [k]: v === "" ? undefined : v } });
  async function go(n: number) {
    if (timer.current) clearTimeout(timer.current);
    pending.current = { ...pending.current, wizardStep: Math.max(n, listing?.wizardStep ?? 1) };
    await flush();
    setStep(n); window.scrollTo({ top: 0 });
  }
  async function submit() {
    if (timer.current) clearTimeout(timer.current);
    await flush();
    setIssues({});
    try { const l = await api.listings.submit(id); setListing(l); setSubmitted(true); }
    catch (e) {
      if (e instanceof ApiError && e.status === 422) setIssues(e.fieldErrors);
      else setIssues({ _: e instanceof ApiError ? e.message : "Could not submit. Try again." });
    }
  }

  if (loadErr === "login") return <div className="section card card-pad"><p>Please log in to continue your listing.</p><Link className="btn btn-primary" href={`/login?next=/post-property/${id}`}>Log in</Link></div>;
  if (loadErr) return <div className="section"><div className="alert alert-error" role="alert">{loadErr}</div><Link href="/dashboard">Back to my listings</Link></div>;
  if (!listing) return <div className="section"><div className="skeleton" style={{ height: 300 }} aria-busy="true" aria-label="Loading listing" /></div>;

  const editable = ["DRAFT", "CHANGES_REQUESTED", "REJECTED", "PUBLISHED", "PAUSED"].includes(listing.status);
  if (submitted || listing.status === "PENDING_REVIEW") {
    return <div className="section card card-pad center"><h1>Submitted for review</h1><p className="muted">We check every listing before it goes live. You will get a notification when it is published or if changes are needed.</p><Link className="btn btn-primary" href="/dashboard">Go to my listings</Link></div>;
  }
  const group = draft.category ? CATEGORY_GROUP[draft.category as PropertyCategory] : null;
  const err = (k: string) => issues[k] ? <p className="field-error" role="alert">{issues[k]}</p> : null;
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const rupeeInput = (k: "pricePaise" | "rentPaise" | "leasePaise" | "depositPaise" | "maintenancePaise", label: string, hint?: string) => (
    <div className="field"><label htmlFor={k}>{label}</label>
      <input id={k} className="input" inputMode="numeric" value={draft[k] !== undefined ? String(draft[k]! / 100) : ""} aria-invalid={!!issues[k]}
        onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ""); update({ [k]: v ? Number(rupeesToPaise(Number(v))) : undefined }); }} />
      <p className="hint">{draft[k] ? formatINR(draft[k]!) : hint ?? "In rupees"}</p>{err(k)}</div>
  );

  return (
    <div className="wizard">
      <nav className="wizard-steps" aria-label="Listing steps">
        <ol>{STEPS.map((s, i) => <li key={s}><button aria-current={step === i + 1 ? "step" : undefined} className={i + 1 < (listing.wizardStep ?? 1) ? "done" : ""} onClick={() => go(i + 1)}>{i + 1}. {s}</button></li>)}</ol>
        <p className="small muted" aria-live="polite" style={{ padding: "8px 10px" }}>
          {save === "saving" ? "Saving…" : save === "saved" ? "All changes saved" : save === "error" ? "Not saved. We will retry." : save === "offline" ? "Offline. Changes will save when you reconnect." : ""}
        </p>
      </nav>

      <section className="card card-pad">
        {listing.status !== "DRAFT" && <div className="alert alert-warn small">Status: {statusLabel(listing.status)}.{listing.lastReview?.note ? ` Moderator note: “${listing.lastReview.note}”` : ""}{listing.status === "PUBLISHED" ? " Changing price, location, title, description or photos sends the listing back for review." : ""}</div>}
        {!editable && <div className="alert alert-info">This listing cannot be edited in its current state.</div>}
        <h1 style={{ fontSize: "1.4rem" }}>{STEPS[step - 1]}</h1>

        {step === 1 && <>
          <fieldset className="field" style={{ border: 0, padding: 0 }}><legend><b>I am the</b></legend>
            <div className="choice-grid">{ADVERTISER_TYPES.map((a) => <button type="button" key={a} className="choice" aria-pressed={draft.advertiserType === a} onClick={() => update({ advertiserType: a })}>{ADVERTISER_LABEL[a]}</button>)}</div>{err("advertiserType")}</fieldset>
          <fieldset className="field" style={{ border: 0, padding: 0 }}><legend><b>I want to</b></legend>
            <div className="choice-grid">{TRANSACTION_TYPES.map((t) => <button type="button" key={t} className="choice" aria-pressed={draft.transaction === t} onClick={() => update({ transaction: t })}>{t === "SALE" ? "Sell" : t === "RENT" ? "Rent out" : "Lease out"}</button>)}</div>{err("transaction")}</fieldset>
          {draft.advertiserType === "AGENT" && <div className="field"><label htmlFor="brok">Brokerage terms (required for agents)</label><input id="brok" className="input" value={draft.brokerageDisclosure ?? ""} onChange={(e) => update({ brokerageDisclosure: e.target.value })} placeholder="e.g. One month's rent" />{err("brokerageDisclosure")}</div>}
        </>}

        {step === 2 && <fieldset className="field" style={{ border: 0, padding: 0 }}><legend className="muted small">Choose the closest match</legend>
          <div className="choice-grid">{PROPERTY_CATEGORIES.map((c) => <button type="button" key={c} className="choice" aria-pressed={draft.category === c} onClick={() => update({ category: c, attributes: draft.category && CATEGORY_GROUP[draft.category as PropertyCategory] === CATEGORY_GROUP[c] ? draft.attributes : {} })}>{CATEGORY_LABEL[c]}</button>)}</div>{err("category")}
          <label className="check" style={{ marginTop: 14 }}><input type="checkbox" checked={!!draft.investmentSuitable} onChange={(e) => update({ investmentSuitable: e.target.checked })} />Also show as suitable for investment <span className="muted small">(do not promise returns)</span></label></fieldset>}

        {step === 3 && <>
          <div className="grid-2">
            <div className="field"><label htmlFor="city">City</label><select id="city" value={draft.cityId ?? ""} onChange={(e) => update({ cityId: e.target.value || undefined, localityId: undefined })} aria-invalid={!!issues.cityId}><option value="">Choose city</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{err("cityId")}</div>
            <div className="field"><label htmlFor="loc">Locality</label><select id="loc" value={draft.localityId ?? ""} disabled={!draft.cityId} onChange={(e) => { const loc = localities.find((l) => l.id === e.target.value); update({ localityId: e.target.value || undefined, postcode: draft.postcode || loc?.postcodes[0] || "" }); }} aria-invalid={!!issues.localityId}><option value="">Choose locality</option>{localities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>{err("localityId")}</div>
          </div>
          <div className="field"><label htmlFor="addr">Full address <span className="muted small">(private, never shown publicly)</span></label><input id="addr" className="input" value={draft.address ?? ""} onChange={(e) => update({ address: e.target.value })} autoComplete="street-address" /></div>
          <div className="grid-2">
            <div className="field"><label htmlFor="pin">PIN code</label><input id="pin" className="input" inputMode="numeric" maxLength={6} value={draft.postcode ?? ""} onChange={(e) => update({ postcode: e.target.value.replace(/\D/g, "") })} />{err("postcode")}</div>
            <div className="field"><label htmlFor="lm">Nearby landmark</label><input id="lm" className="input" value={draft.landmark ?? ""} onChange={(e) => update({ landmark: e.target.value })} /></div>
          </div>
          <p className="hint">Buyers see only the locality and an approximate map area.</p>
        </>}

        {step === 4 && <>
          {!group && <div className="alert alert-warn">Choose a property type first. <button className="btn btn-ghost btn-sm" onClick={() => go(2)}>Go to step 2</button></div>}
          <div className="field"><label htmlFor="title">Listing title</label><input id="title" className="input" maxLength={120} value={draft.title ?? ""} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. Bright 2 BHK near Adyar depot" aria-invalid={!!issues.title} />{err("title")}</div>
          <div className="field"><label htmlFor="desc">Description</label><textarea id="desc" maxLength={5000} value={draft.description ?? ""} onChange={(e) => update({ description: e.target.value })} aria-invalid={!!issues.description} /><p className="hint">{(draft.description ?? "").length}/5000. Mention what makes it special, nearby facilities and any conditions.</p>{err("description")}</div>
          {group === "RESIDENTIAL" && <>
            <div className="grid-3">
              {(["bedrooms", "bathrooms", "balconies"] as const).map((k) => <div key={k} className="field"><label htmlFor={k}>{k[0]!.toUpperCase() + k.slice(1)}</label><input id={k} className="input" type="number" min={0} max={20} value={String(draft.attributes[k] ?? "")} onChange={(e) => setAttr(k, num(e.target.value))} aria-invalid={!!issues[`attributes.${k}`]} />{err(`attributes.${k}`)}</div>)}
              <div className="field"><label htmlFor="floor">Floor</label><input id="floor" className="input" type="number" value={String(draft.attributes.floor ?? "")} onChange={(e) => setAttr("floor", num(e.target.value))} />{err("attributes.floor")}</div>
              <div className="field"><label htmlFor="tf">Total floors</label><input id="tf" className="input" type="number" min={1} value={String(draft.attributes.totalFloors ?? "")} onChange={(e) => setAttr("totalFloors", num(e.target.value))} /></div>
              <div className="field"><label htmlFor="age">Age (years)</label><input id="age" className="input" type="number" min={0} value={String(draft.attributes.ageYears ?? "")} onChange={(e) => setAttr("ageYears", num(e.target.value))} /></div>
            </div>
            <div className="grid-2">
              <div className="field"><label htmlFor="furn">Furnishing</label><select id="furn" value={String(draft.attributes.furnishing ?? "")} onChange={(e) => setAttr("furnishing", e.target.value)} aria-invalid={!!issues["attributes.furnishing"]}><option value="">Choose</option><option value="UNFURNISHED">Unfurnished</option><option value="SEMI_FURNISHED">Semi-furnished</option><option value="FURNISHED">Furnished</option></select>{err("attributes.furnishing")}</div>
              <div className="field"><label htmlFor="park">Parking</label><select id="park" value={String(draft.attributes.parking ?? "")} onChange={(e) => setAttr("parking", e.target.value)}><option value="">Choose</option><option value="NONE">None</option><option value="BIKE">Two-wheeler</option><option value="CAR">Car</option><option value="BOTH">Car and two-wheeler</option></select></div>
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0 }}><legend><b>Area (sq ft)</b> <span className="muted small">Enter at least one. These are different measurements; do not copy one into another.</span></legend>
              <div className="grid-3">{([["carpetAreaSqft", "Carpet"], ["builtUpAreaSqft", "Built-up"], ["superBuiltUpAreaSqft", "Super built-up"]] as const).map(([k, l]) => <div key={k}><label htmlFor={k}>{l}</label><input id={k} className="input" inputMode="decimal" value={String(draft.attributes[k] ?? "")} onChange={(e) => setAttr(k, num(e.target.value))} /></div>)}</div>{err("attributes.carpetAreaSqft")}</fieldset>
          </>}
          {group === "LAND" && <>
            <div className="grid-2">
              <div className="field"><label htmlFor="pa">Plot area</label><input id="pa" className="input" inputMode="decimal" value={String(draft.attributes.plotArea ?? "")} onChange={(e) => setAttr("plotArea", num(e.target.value))} aria-invalid={!!issues["attributes.plotArea"]} />{err("attributes.plotArea")}</div>
              <div className="field"><label htmlFor="pu">Unit</label><select id="pu" value={String(draft.attributes.plotAreaUnit ?? "")} onChange={(e) => setAttr("plotAreaUnit", e.target.value)}><option value="">Choose</option>{AREA_UNITS.map((u) => <option key={u} value={u}>{AREA_UNIT_LABEL[u]}</option>)}</select><p className="hint">1 ground = 2,400 sq ft; 1 cent = 435.6 sq ft</p>{err("attributes.plotAreaUnit")}</div>
              <div className="field"><label htmlFor="fr">Frontage (ft)</label><input id="fr" className="input" inputMode="decimal" value={String(draft.attributes.frontageFt ?? "")} onChange={(e) => setAttr("frontageFt", num(e.target.value))} /></div>
              <div className="field"><label htmlFor="ra">Road access</label><select id="ra" value={String(draft.attributes.roadAccess ?? "")} onChange={(e) => setAttr("roadAccess", e.target.value)}><option value="">Choose</option><option value="TAR">Tar road</option><option value="CONCRETE">Concrete road</option><option value="MUD">Mud road</option><option value="NONE">No direct road</option></select></div>
            </div>
            <div className="field"><label htmlFor="pu2">Permitted use (as you understand it)</label><input id="pu2" className="input" value={String(draft.attributes.permittedUseClaim ?? "")} onChange={(e) => setAttr("permittedUseClaim", e.target.value)} placeholder="e.g. Residential, DTCP approved layout" /><p className="hint">Shown as your statement. ProperBySel does not verify approvals or title.</p></div>
            <div className="grid-2">
              <div className="field"><label htmlFor="wa">Water</label><input id="wa" className="input" value={String(draft.attributes.water ?? "")} onChange={(e) => setAttr("water", e.target.value)} /></div>
              <div className="field"><label htmlFor="el">Electricity</label><input id="el" className="input" value={String(draft.attributes.electricity ?? "")} onChange={(e) => setAttr("electricity", e.target.value)} /></div>
            </div>
          </>}
          {group === "COMMERCIAL" && <div className="grid-2">
            <div className="field"><label htmlFor="bua">Built-up area (sq ft)</label><input id="bua" className="input" inputMode="decimal" value={String(draft.attributes.builtUpAreaSqft ?? "")} onChange={(e) => setAttr("builtUpAreaSqft", num(e.target.value))} aria-invalid={!!issues["attributes.builtUpAreaSqft"]} />{err("attributes.builtUpAreaSqft")}</div>
            <div className="field"><label htmlFor="sf">Suitable for</label><input id="sf" className="input" value={String(draft.attributes.suitableFor ?? "")} onChange={(e) => setAttr("suitableFor", e.target.value)} /></div>
            <div className="field"><label htmlFor="cfl">Floor</label><input id="cfl" className="input" type="number" value={String(draft.attributes.floor ?? "")} onChange={(e) => setAttr("floor", num(e.target.value))} /></div>
            <div className="field"><label htmlFor="kva">Power (kVA)</label><input id="kva" className="input" inputMode="decimal" value={String(draft.attributes.powerKva ?? "")} onChange={(e) => setAttr("powerKva", num(e.target.value))} /></div>
            <div className="field"><label htmlFor="ch">Ceiling height (ft)</label><input id="ch" className="input" inputMode="decimal" value={String(draft.attributes.ceilingHeightFt ?? "")} onChange={(e) => setAttr("ceilingHeightFt", num(e.target.value))} /></div>
            <div className="field"><label htmlFor="ps">Parking slots</label><input id="ps" className="input" type="number" min={0} value={String(draft.attributes.parkingSlots ?? "")} onChange={(e) => setAttr("parkingSlots", num(e.target.value))} /></div>
            <div className="field"><label htmlFor="wr">Washrooms</label><input id="wr" className="input" type="number" min={0} value={String(draft.attributes.washrooms ?? "")} onChange={(e) => setAttr("washrooms", num(e.target.value))} /></div>
            <label className="check"><input type="checkbox" checked={!!draft.attributes.loadingAccess} onChange={(e) => setAttr("loadingAccess", e.target.checked)} />Truck loading access</label>
          </div>}
          {group && group !== "LAND" && <fieldset className="field" style={{ border: 0, padding: 0 }}><legend><b>Amenities</b></legend>
            <div className="grid-2">{AMENITIES.map((a) => <label key={a} className="check"><input type="checkbox" checked={(draft.amenities ?? []).includes(a)} onChange={(e) => update({ amenities: e.target.checked ? [...(draft.amenities ?? []), a] : (draft.amenities ?? []).filter((x) => x !== a) })} />{AMENITY_LABEL(a)}</label>)}</div></fieldset>}
        </>}

        {step === 5 && <>
          {!draft.transaction && <div className="alert alert-warn">Choose sale, rent or lease in step 1 first.</div>}
          {draft.transaction === "SALE" && rupeeInput("pricePaise", "Expected sale price")}
          {draft.transaction === "RENT" && <>{rupeeInput("rentPaise", "Monthly rent")}{rupeeInput("depositPaise", "Security deposit")}</>}
          {draft.transaction === "LEASE" && <>{rupeeInput("leasePaise", "Lease amount", "Total lease amount in rupees")}{rupeeInput("depositPaise", "Deposit")}</>}
          {draft.transaction && group !== "LAND" && rupeeInput("maintenancePaise", "Monthly maintenance (optional)")}
          <label className="check"><input type="checkbox" checked={!!draft.negotiable} onChange={(e) => update({ negotiable: e.target.checked })} />Price is negotiable</label>
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="af">Available from</label><input id="af" type="date" className="input" value={draft.availableFrom ? new Date(draft.availableFrom).toISOString().slice(0, 10) : ""} onChange={(e) => update({ availableFrom: e.target.value ? new Date(e.target.value) : undefined })} /></div>
        </>}

        {step === 6 && <Photos listing={listing} onChange={setListing} />}

        {step === 7 && <>
          <label className="check"><input type="checkbox" checked={!!draft.showPhone} onChange={(e) => update({ showPhone: e.target.checked })} />Show my phone number to people who have sent an enquiry</label>
          <p className="hint">If unchecked, people can reach you only through ProperBySel messages.</p>
          <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={!!draft.contactConsent} onChange={(e) => update({ contactConsent: e.target.checked })} />I confirm the details are accurate, I am allowed to advertise this property, and I agree to be contacted about it.</label>
          {err("contactConsent")}
        </>}

        {step === 8 && <Review draft={draft} listing={listing} cities={cities} localities={localities} issues={issues} onSubmit={submit} go={go} />}

        <div className="row" style={{ marginTop: 20, borderTop: "1px solid var(--sand-200)", paddingTop: 14 }}>
          {step > 1 && <button className="btn btn-ghost" onClick={() => go(step - 1)}>Back</button>}
          <div className="spacer" />
          {step < 8 && <button className="btn btn-primary" onClick={() => go(step + 1)}>Save and continue</button>}
        </div>
      </section>
    </div>
  );
}

function Photos({ listing, onChange }: { listing: OwnerListing; onChange: (l: OwnerListing) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    for (const f of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setErr(`${f.name}: photos must be JPEG, PNG or WebP`); continue; }
      if (f.size > 8 * 1024 * 1024) { setErr(`${f.name} is larger than 8 MB`); continue; }
      const fd = new FormData(); fd.append("file", f);
      try { await api.listings.uploadPhoto(listing.id, fd); } catch (e) { setErr(`${f.name}: ${e instanceof ApiError ? e.message : "upload failed"}. Try again.`); }
    }
    onChange(await api.listings.get(listing.id)); setBusy(false);
  }
  async function remove(mediaId: string) { await api.listings.deletePhoto(listing.id, mediaId); onChange(await api.listings.get(listing.id)); }
  async function uploadDoc(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("label", f.name); fd.append("file", f);
    try { await api.listings.uploadDocument(listing.id, fd); setDocMsg(`${f.name} uploaded privately.`); } catch (e) { setDocMsg(e instanceof ApiError ? e.message : "Upload failed"); }
  }
  return (
    <div className="stack">
      <p className="muted small">Add at least 3 clear photos. We remove location data (GPS) from photos automatically. JPEG, PNG or WebP, up to 8 MB each.</p>
      <label className="btn btn-navy" style={{ width: "fit-content" }}>{busy ? "Uploading…" : "Add photos"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} disabled={busy} /></label>
      {err && <div className="alert alert-error" role="alert">{err}</div>}
      {listing.media.length === 0 ? <div className="empty card">No photos yet.</div> : (
        <div className="photo-grid">{listing.media.map((m, i) => <figure key={m.id}><img src={`/api/proxy${m.url}`} alt={`Photo ${i + 1}`} /><button className="btn btn-sm btn-danger" onClick={() => remove(m.id)} aria-label={`Remove photo ${i + 1}`}>✕</button></figure>)}</div>
      )}
      <div className="card card-pad"><h2 style={{ fontSize: "1rem" }}>Supporting documents (optional, private)</h2>
        <p className="small muted">For example a patta, tax receipt or approval letter. Only you and ProperBySel moderators can see these. Do not upload Aadhaar.</p>
        <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => uploadDoc(e.target.files)} aria-label="Upload a private document" />
        {docMsg && <p className="small" role="status">{docMsg}</p>}
      </div>
    </div>
  );
}

function Review({ draft, listing, cities, localities, issues, onSubmit, go }: { draft: Draft; listing: OwnerListing; cities: City[]; localities: Locality[]; issues: Record<string, string>; onSubmit: () => void; go: (n: number) => void }) {
  const [busy, setBusy] = useState(false);
  const stepFor = (path: string) => path.startsWith("attributes") || path === "title" || path === "description" ? 4 : ["cityId", "localityId", "postcode"].includes(path) ? 3 : ["pricePaise", "rentPaise", "leasePaise"].includes(path) ? 5 : path === "contactConsent" ? 7 : path === "category" ? 2 : 1;
  const price = draft.pricePaise ?? draft.rentPaise ?? draft.leasePaise;
  return (
    <div className="stack">
      <dl className="facts">
        <div className="fact"><dt className="small muted">Posting as</dt><dd><b>{draft.advertiserType ? ADVERTISER_LABEL[draft.advertiserType] : "—"}</b></dd></div>
        <div className="fact"><dt className="small muted">Type</dt><dd><b>{draft.category ? CATEGORY_LABEL[draft.category as PropertyCategory] : "—"}</b></dd></div>
        <div className="fact"><dt className="small muted">Location</dt><dd><b>{localities.find((l) => l.id === draft.localityId)?.name ?? "—"}, {cities.find((c) => c.id === draft.cityId)?.name ?? ""}</b></dd></div>
        <div className="fact"><dt className="small muted">Price</dt><dd><b>{price ? formatINR(price) : "—"}</b></dd></div>
        <div className="fact"><dt className="small muted">Photos</dt><dd><b>{listing.media.length}</b></dd></div>
      </dl>
      <h2 style={{ fontSize: "1.1rem", margin: 0 }}>{draft.title || "Untitled"}</h2>
      <p className="muted" style={{ whiteSpace: "pre-line" }}>{draft.description}</p>
      {listing.media.length < 3 && <div className="alert alert-warn small">Listings with at least 3 photos get more enquiries. <button className="btn btn-ghost btn-sm" onClick={() => go(6)}>Add photos</button></div>}
      {Object.keys(issues).length > 0 && <div className="alert alert-error" role="alert"><b>Please fix these before submitting:</b><ul>{Object.entries(issues).map(([k, v]) => <li key={k}>{v} {k !== "_" && <button className="btn btn-ghost btn-sm" onClick={() => go(stepFor(k))}>Fix</button>}</li>)}</ul></div>}
      <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await onSubmit(); setBusy(false); }}>{busy ? "Submitting…" : "Submit for review"}</button>
      <p className="small muted">By submitting, you confirm the listing follows our <a href="/terms">terms</a>. A moderator will review it before it goes live.</p>
    </div>
  );
}
