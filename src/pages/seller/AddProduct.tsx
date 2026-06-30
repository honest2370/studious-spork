import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button, showToast } from "@/components/ui";
import type { ProductType, CourseModule, CourseLesson } from "@/types";

function parseSlotLine(line: string): { cred1: string; cred2: string } {
  const parts = line.split(":").map((s) => s.trim());
  if (parts.length === 2) return { cred1: parts[0], cred2: parts[1] };
  if (parts.length === 4) return { cred1: `${parts[0]}:${parts[1]}`, cred2: `${parts[2]}:${parts[3]}` };
  return { cred1: line.trim(), cred2: "" };
}

const emptyLesson = (): CourseLesson => ({ title: "", duration: "", video_url: "", attachment_url: "", notes: "" });

export default function AddProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams(); // present when editing

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<ProductType>("digital");
  const [deliveryLink, setDeliveryLink] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  // Account-type fields
  const [platform, setPlatform] = useState("");
  const [cred1Label, setCred1Label] = useState("Email");
  const [cred2Label, setCred2Label] = useState("Password");
  const [slotsBulk, setSlotsBulk] = useState("");
  const [slotInstructions, setSlotInstructions] = useState("");

  // Course-type fields
  const [modules, setModules] = useState<CourseModule[]>([{ title: "Module 1", lessons: [emptyLesson()] }]);

  const [submitting, setSubmitting] = useState(false);

  const slotCount = slotsBulk.split("\n").map((l) => l.trim()).filter(Boolean).length;

  function addModule() { setModules([...modules, { title: `Module ${modules.length + 1}`, lessons: [emptyLesson()] }]); }
  function removeModule(i: number) { setModules(modules.filter((_, idx) => idx !== i)); }
  function addLesson(mi: number) {
    const next = [...modules];
    next[mi] = { ...next[mi], lessons: [...next[mi].lessons, emptyLesson()] };
    setModules(next);
  }
  function updateLesson(mi: number, li: number, field: keyof CourseLesson, value: string) {
    const next = [...modules];
    next[mi].lessons[li] = { ...next[mi].lessons[li], [field]: value };
    setModules(next);
  }
  function updateModuleTitle(mi: number, value: string) {
    const next = [...modules];
    next[mi] = { ...next[mi], title: value };
    setModules(next);
  }

  async function handleSubmit() {
    if (!user || !title || !price) { showToast("Title and price are required", "error"); return; }
    setSubmitting(true);

    const curriculum = type === "course"
      ? modules.filter((m) => m.lessons.some((l) => l.title || l.video_url)).map((m) => ({
          ...m, lessons: m.lessons.filter((l) => l.title || l.video_url),
        }))
      : null;

    const { data: inserted, error } = await sb.from("products").insert({
      seller_id: user.id, seller_name: user.name, title, description, price: Number(price),
      type, delivery_link: type !== "account" ? deliveryLink : null, cover_url: coverUrl || null,
      status: "pending", curriculum,
      account_platform: type === "account" ? platform : null,
      cred1_label: type === "account" ? cred1Label : null,
      cred2_label: type === "account" ? cred2Label : null,
      slot_instructions: type === "account" ? slotInstructions : null,
    }).select("id").single();

    if (error || !inserted) {
      setSubmitting(false);
      showToast(error?.message || "Failed to create product", "error");
      return;
    }

    if (type === "account") {
      const lines = slotsBulk.split("\n").map((l) => l.trim()).filter(Boolean);
      const slotRows = lines.map((line) => {
        const { cred1, cred2 } = parseSlotLine(line);
        return {
          product_id: inserted.id, seller_id: user.id, platform,
          cred1_label: cred1Label, cred2_label: cred2Label,
          cred1_value: cred1, cred2_value: cred2, status: "available",
        };
      });
      if (slotRows.length > 0) {
        await sb.from("account_slots").insert(slotRows);
        await sb.from("products").update({ total_slots: slotRows.length, available_slots: slotRows.length }).eq("id", inserted.id);
      }
    }

    setSubmitting(false);
    showToast("Product submitted for review!", "success");
    navigate("/seller/products");
  }

  const fieldClass = "w-full rounded-xl border border-slate-700 bg-slate-800 text-white px-4 py-3 text-sm outline-none focus:border-blue-500 mb-3";
  const labelClass = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase";

  return (
    <div className="p-4 pb-28 bg-slate-950 min-h-screen">
      <button onClick={() => navigate(-1)} className="text-blue-400 text-sm font-semibold mb-4">← Back</button>
      <h1 className="text-xl font-extrabold text-white mb-6">{id ? "Edit Product" : "Add New Product"}</h1>

      <label className={labelClass}>Product Title</label>
      <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />

      <label className={labelClass}>Description</label>
      <textarea className={fieldClass} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

      <label className={labelClass}>Price</label>
      <input className={fieldClass} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />

      <label className={labelClass}>Cover Image URL</label>
      <input className={fieldClass} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />

      <label className={labelClass}>Product Type</label>
      <select className={fieldClass} value={type} onChange={(e) => setType(e.target.value as ProductType)}>
        <option value="digital">Digital File / Link</option>
        <option value="account">Account / Proxy (slot inventory)</option>
        <option value="course">Course</option>
      </select>

      {type !== "account" && (
        <>
          <label className={labelClass}>Delivery Link</label>
          <input className={fieldClass} value={deliveryLink} onChange={(e) => setDeliveryLink(e.target.value)} placeholder="https://…" />
        </>
      )}

      {type === "account" && (
        <div className="bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-800">
          <p className="text-white font-bold mb-3">📦 Account Inventory</p>
          <label className={labelClass}>Platform name</label>
          <input className={fieldClass} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. Netflix" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>Field 1 label</label>
              <input className={fieldClass} value={cred1Label} onChange={(e) => setCred1Label(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Field 2 label</label>
              <input className={fieldClass} value={cred2Label} onChange={(e) => setCred2Label(e.target.value)} />
            </div>
          </div>
          <label className={labelClass}>
            📊 {slotCount} slot{slotCount === 1 ? "" : "s"} — add accounts (one per line)
          </label>
          <textarea className={fieldClass} rows={6} value={slotsBulk} onChange={(e) => setSlotsBulk(e.target.value)}
            placeholder={"user1:pass1\nuser2:pass2\n192.168.0.1:8080:user:pass"} />
          <label className={labelClass}>Setup instructions (shown to buyer after purchase)</label>
          <textarea className={fieldClass} rows={3} value={slotInstructions} onChange={(e) => setSlotInstructions(e.target.value)} />
        </div>
      )}

      {type === "course" && (
        <div className="bg-slate-900 rounded-2xl p-4 mb-4 border border-slate-800">
          <p className="text-white font-bold mb-3">🎬 Curriculum Builder</p>
          {modules.map((mod, mi) => (
            <div key={mi} className="bg-slate-800 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <input className="flex-1 rounded-lg border border-slate-700 bg-slate-900 text-white px-3 py-2 text-sm"
                  value={mod.title} onChange={(e) => updateModuleTitle(mi, e.target.value)} />
                <button onClick={() => removeModule(mi)} className="text-red-400 px-2">✕</button>
              </div>
              {mod.lessons.map((lesson, li) => (
                <div key={li} className="bg-slate-900 rounded-lg p-3 mb-2">
                  <input className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm mb-2"
                    placeholder="Lesson title" value={lesson.title} onChange={(e) => updateLesson(mi, li, "title", e.target.value)} />
                  <input className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm mb-2"
                    placeholder="Video URL (YouTube, Vimeo…)" value={lesson.video_url} onChange={(e) => updateLesson(mi, li, "video_url", e.target.value)} />
                  <textarea className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm"
                    placeholder="Lesson notes" rows={2} value={lesson.notes} onChange={(e) => updateLesson(mi, li, "notes", e.target.value)} />
                </div>
              ))}
              <button onClick={() => addLesson(mi)} className="w-full bg-slate-700 text-white rounded-lg py-2 text-sm font-semibold">+ Add lesson</button>
            </div>
          ))}
          <button onClick={addModule} className="w-full bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold">+ Add module / chapter</button>
        </div>
      )}

      <Button fullWidth disabled={submitting} onClick={handleSubmit}>{submitting ? "Submitting…" : "Submit for Review"}</Button>
    </div>
  );
}
