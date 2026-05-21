"use client";

import { ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type WorkflowItem = {
  label: string;
  done: boolean;
  templateSlug?: string;
  previewHref?: string;
  dipTemplate?: "config";
};

type WorkflowSection = {
  title: string;
  items: WorkflowItem[];
};

type EmailAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
};

type EmailTemplatePayload = {
  slug: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  isActive: boolean;
  brandName: string;
  transportConfigured: boolean;
  signaturePreview: string;
  signatureProfile: {
    firstname: string;
    lastname: string;
    professionalEmail: string;
    professionalPhone: string;
    professionalRole: string;
    photoDataUrl: string;
  };
  attachments: EmailAttachment[];
};

type DipTemplatePayload = {
  version: string;
  docusignTemplateId: string;
  docusignTemplateRoleName: string;
  mainDocument: {
    id: string;
    fileName: string;
    mimeType: string;
    uploadedAt: string;
    fileUrl: string;
  } | null;
  annexes: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    uploadedAt: string;
    fileUrl: string;
  }>;
};

const DIP_VARIABLE_MEMO = [
  { label: "Candidat", value: "{{candidateFullName}}" },
  { label: "Date de naissance", value: "{{birthDate}}" },
  { label: "Lieu de naissance", value: "{{birthPlace}}" },
  { label: "Email", value: "{{candidateEmail}}" },
  { label: "Téléphone", value: "{{candidatePhone}}" },
  { label: "Adresse du domicile", value: "{{candidateAddress}}" },
  { label: "Ville d’implantation du projet", value: "{{projectZone}}" },
  { label: "Code postal du projet", value: "{{projectZipcode}}" }
] as const;

const RECEIPT_VARIABLE_MEMO = [
  { label: "Candidat", value: "{{candidateFullName}}" },
  { label: "Date de naissance", value: "{{birthDate}}" },
  { label: "Lieu de naissance", value: "{{birthPlace}}" },
  { label: "Email", value: "{{candidateEmail}}" },
  { label: "Téléphone", value: "{{candidatePhone}}" },
  { label: "Adresse du domicile", value: "{{candidateAddress}}" },
  { label: "Enseigne", value: "{{brandName}}" },
  { label: "Date d’envoi du DIP", value: "{{dipSentAt}}" }
] as const;

function textToHtml(text: string) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) =>
      `<p>${paragraph
        .replaceAll("{{applicationUrl}}", `<a href="{{applicationUrl}}">{{applicationUrl}}</a>`)
        .replaceAll("{{bookingUrl}}", `<a href="{{bookingUrl}}">{{bookingUrl}}</a>`)
        .replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

function getTemplateTitle(slug: string) {
  if (slug === "candidate-application-invitation") return "Dossier de candidature";
  if (slug === "candidate-application-visio") return "Dossier complet + visio";
  if (slug === "candidate-discovery-invitation") return "Journée découverte";
  if (slug === "candidate-discovery-feedback") return "Retour de journée découverte";
  if (slug === "mapping-manager-notification") return "Notification responsable mapping";
  if (slug === "candidate-local-project-opened") return "Ouverture projet local et statuts";
  return slug;
}

function htmlToPlainText(html: string) {
  if (typeof window === "undefined") {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent?.replace(/\s+/g, " ").trim() || "";
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "absolute";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
}

function sanitizeRichTextHtml(html: string) {
  if (typeof window === "undefined") {
    return html.trim();
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;

  temp.querySelectorAll("script,style,meta,link").forEach((node) => node.remove());
  temp.querySelectorAll(".Apple-converted-space").forEach((node) => node.replaceWith(document.createTextNode(" ")));
  temp.querySelectorAll("[class]").forEach((node) => node.removeAttribute("class"));

  temp.querySelectorAll("h1,h2,h3,p").forEach((node) => {
    const hasBlockChildren = Array.from(node.children).some((child) =>
      ["P", "DIV", "UL", "OL", "H1", "H2", "H3"].includes(child.tagName)
    );
    if (hasBlockChildren) {
      const fragment = document.createDocumentFragment();
      while (node.firstChild) {
        fragment.appendChild(node.firstChild);
      }
      node.replaceWith(fragment);
    }
  });

  temp.querySelectorAll("p").forEach((node) => {
    const hasListChildren = Array.from(node.children).some((child) => ["UL", "OL"].includes(child.tagName));
    if (hasListChildren) {
      const fragment = document.createDocumentFragment();
      while (node.firstChild) {
        fragment.appendChild(node.firstChild);
      }
      node.replaceWith(fragment);
    }
  });

  return temp.innerHTML.trim();
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
  pageMode = false,
  showSignatureGuide = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  pageMode?: boolean;
  showSignatureGuide?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputId = useId();
  const [blockStyle, setBlockStyle] = useState("p");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState("3");

  useEffect(() => {
    if (!editorRef.current) return;
    const nextValue = sanitizeRichTextHtml(value);
    if (editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  }, [value]);

  function focusEditor() {
    editorRef.current?.focus();
  }

  function runCommand(command: string, commandValue?: string) {
    focusEditor();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, commandValue);
    onChange(sanitizeRichTextHtml(editorRef.current?.innerHTML || ""));
  }

  function handleImageUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const maxWidth = 1200;
          const ratio = Math.min(1, maxWidth / image.width);
          canvas.width = Math.round(image.width * ratio);
          canvas.height = Math.round(image.height * ratio);
          const context = canvas.getContext("2d");
          if (!context) {
            runCommand("insertImage", result);
            return;
          }
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          runCommand("insertImage", canvas.toDataURL("image/jpeg", 0.9));
        };
        image.src = result;
      }
    };
    reader.readAsDataURL(file);
  }

  function handleLinkInsert() {
    const url = window.prompt("Lien à insérer");
    if (!url) return;
    runCommand("createLink", url);
  }

  const blockStyleLabel =
    blockStyle === "h1" ? "T1" : blockStyle === "h2" ? "T2" : blockStyle === "h3" ? "T3" : "Normal";
  const fontFamilyLabel = fontFamily === "Times New Roman" ? "Times" : fontFamily;
  const fontSizeLabel =
    fontSize === "2" ? "10" : fontSize === "3" ? "11" : fontSize === "4" ? "12" : fontSize === "5" ? "14" : "18";
  const pdfPageGuideTop = 72 + 708;
  const signatureGuideTop = 72 + 708 - 170;

  return (
    <div className={`overflow-hidden ${pageMode ? "flex h-full flex-col rounded-none border-0 bg-transparent" : "rounded-2xl border border-slate-200 bg-white"}`}>
      <div
        className={`flex items-center gap-1 overflow-hidden border-b border-slate-200 px-2 py-1.5 whitespace-nowrap ${pageMode ? "sticky top-0 z-20 bg-white" : "bg-slate-50"}`}
      >
        <label className="relative inline-flex h-7 w-[82px] shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700">
          <span className="truncate pr-3">{blockStyleLabel}</span>
          <select
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={blockStyle}
            onChange={(event) => {
              setBlockStyle(event.target.value);
              runCommand("formatBlock", event.target.value);
            }}
          >
            <option value="p">Normal</option>
            <option value="h1">T1</option>
            <option value="h2">T2</option>
            <option value="h3">T3</option>
          </select>
          <span className="pointer-events-none absolute right-2 text-[8px] text-slate-500">▼</span>
        </label>
        <label className="relative inline-flex h-7 w-[72px] shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700">
          <span className="truncate pr-3">{fontFamilyLabel}</span>
          <select
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={fontFamily}
            onChange={(event) => {
              setFontFamily(event.target.value);
              runCommand("fontName", event.target.value);
            }}
          >
            <option value="Arial">Arial</option>
            <option value="Verdana">Verdana</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times</option>
          </select>
          <span className="pointer-events-none absolute right-2 text-[8px] text-slate-500">▼</span>
        </label>
        <label className="relative inline-flex h-7 w-[48px] shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700">
          <span className="truncate pr-2">{fontSizeLabel}</span>
          <select
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={fontSize}
            onChange={(event) => {
              setFontSize(event.target.value);
              runCommand("fontSize", event.target.value);
            }}
          >
            <option value="2">10</option>
            <option value="3">11</option>
            <option value="4">12</option>
            <option value="5">14</option>
            <option value="6">18</option>
          </select>
          <span className="pointer-events-none absolute right-1.5 text-[8px] text-slate-500">▼</span>
        </label>
        <button
          type="button"
          onClick={() => runCommand("decreaseFontSize")}
          className="inline-flex h-7 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] text-slate-700 hover:border-slate-300"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => runCommand("increaseFontSize")}
          className="inline-flex h-7 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] text-slate-700 hover:border-slate-300"
        >
          +
        </button>
        {[
          { label: "B", command: "bold", className: "font-bold" },
          { label: "I", command: "italic", className: "italic" },
          { label: "U", command: "underline", className: "underline" }
        ].map((item) => (
          <button
            key={item.command}
            type="button"
            onClick={() => runCommand(item.command)}
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-0 text-[10px] text-slate-700 hover:border-slate-300 ${item.className}`}
          >
            {item.label}
          </button>
        ))}
        <label className="inline-flex h-7 w-12 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-1 text-[10px] text-slate-700">
          <span>A</span>
          <input
            type="color"
            defaultValue="#0f172a"
            className="h-3.5 w-3.5 cursor-pointer border-0 bg-transparent p-0"
            onChange={(event) => runCommand("foreColor", event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={handleLinkInsert}
          className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-1 text-[10px] text-slate-700 hover:border-slate-300"
        >
          Lnk
        </button>
        <label
          htmlFor={imageInputId}
          className="inline-flex h-7 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-1 text-[10px] text-slate-700 hover:border-slate-300"
        >
          Img
        </label>
        <input
          id={imageInputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            handleImageUpload(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <button type="button" onClick={() => runCommand("insertUnorderedList")} className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-1 text-[10px] text-slate-700 hover:border-slate-300">
          •
        </button>
        <button type="button" onClick={() => runCommand("insertOrderedList")} className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-1 text-[10px] text-slate-700 hover:border-slate-300">
          1.
        </button>
        <button type="button" onClick={() => runCommand("justifyLeft")} className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-1 text-[10px] text-slate-700 hover:border-slate-300">
          ←
        </button>
        <button type="button" onClick={() => runCommand("justifyCenter")} className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-1 text-[10px] text-slate-700 hover:border-slate-300">
          ↔
        </button>
      </div>
      {pageMode ? (
        <div className="h-full flex-1 overflow-y-auto overscroll-contain bg-[#f1f3f4] px-8 py-8">
          <div className="relative mx-auto w-full max-w-[820px]">
            <div
              className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-[#007cbd]/45"
              style={{ top: `${pdfPageGuideTop}px` }}
            />
            <div
              className="pointer-events-none absolute right-3 z-10 rounded-full bg-white/96 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#007cbd] shadow-sm"
              style={{ top: `${pdfPageGuideTop - 14}px` }}
            >
              Page 2
            </div>
            {showSignatureGuide ? (
              <div
                className="pointer-events-none absolute left-[76px] right-[76px] z-10 rounded-2xl border border-emerald-300/80 bg-emerald-50/70"
                style={{ top: `${signatureGuideTop}px`, height: "170px" }}
              >
                <div className="absolute left-4 top-3 rounded-full bg-white/96 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 shadow-sm">
                  Zone réservée à la signature DocuSign
                </div>
              </div>
            ) : null}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => onChange(sanitizeRichTextHtml(editorRef.current?.innerHTML || ""))}
              className="min-h-[1120px] bg-white px-[76px] py-[72px] text-[14px] leading-7 text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.16)] outline-none [&_h1]:mb-6 [&_h1]:text-[28px] [&_h1]:font-semibold [&_h2]:mb-4 [&_h2]:text-[22px] [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:text-[18px] [&_h3]:font-semibold [&_img]:my-4 [&_img]:max-h-[320px] [&_img]:rounded-none [&_img]:object-contain [&_li]:mb-1 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
              data-placeholder={placeholder || ""}
            />
          </div>
        </div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(sanitizeRichTextHtml(editorRef.current?.innerHTML || ""))}
          className="min-h-[420px] px-4 py-3 text-[13px] leading-6 text-slate-900 outline-none [&_img]:my-3 [&_img]:max-h-56 [&_img]:rounded-2xl [&_img]:object-contain [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
          data-placeholder={placeholder || ""}
        />
      )}
      {!htmlToPlainText(value) ? (
        <div className="pointer-events-none -mt-[calc(100%)] hidden" />
      ) : null}
    </div>
  );
}

function DipTemplateModal({
  onClose
}: {
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<null | "main" | "annex">(null);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<DipTemplatePayload | null>(null);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      setMounted(false);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/dip-template");
        if (!response.ok) {
          throw new Error("Impossible de charger le modèle DIP.");
        }
        const data = (await response.json()) as DipTemplatePayload;
        if (!cancelled) {
          setTemplate(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger le modèle DIP.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTemplate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/dip-template", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: template.version,
          docusignTemplateId: template.docusignTemplateId,
          docusignTemplateRoleName: template.docusignTemplateRoleName
        })
      });

      if (!response.ok) {
        throw new Error("Impossible d'enregistrer le modèle DIP.");
      }

      setTemplate((await response.json()) as DipTemplatePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le modèle DIP.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File | null, kind: "main" | "annex") {
    if (!file) return;
    setUploading(kind);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);

      const response = await fetch("/api/admin/dip-template", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Impossible d'ajouter ce document DIP.");
      }

      setTemplate((await response.json()) as DipTemplatePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter ce document DIP.");
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(documentId: string) {
    const confirmed = window.confirm("Supprimer ce document ?");
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/dip-template?documentId=${documentId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Impossible de supprimer ce document.");
      }

      setTemplate((await response.json()) as DipTemplatePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer ce document.");
    }
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[5000] overflow-hidden bg-[#f1f3f4]" onClick={onClose}>
      <div
        className="flex h-screen w-full flex-col overflow-hidden overscroll-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#007cbd]">Workflow DIP</p>
            <h2 className="mt-1 text-[18px] font-semibold text-slate-950">Configuration simplifiée du DIP</h2>
          </div>
          <div className="flex items-center gap-3">
            {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !template}
              className="rounded-2xl bg-[#007cbd] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#00679d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-slate-500">Chargement du modèle DIP…</div>
        ) : template ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f1f3f4] px-6 py-6">
            <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-5">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-[15px] font-semibold text-slate-950">Modèle DocuSign d’accusé de réception</h3>
                  <p className="mt-1 text-[12px] leading-5 text-slate-500">
                    Zonara utilisera ce modèle DocuSign comme premier document à signer, puis joindra le DIP PDF, les annexes PDF et l’ELM du candidat.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-[12px] font-medium text-slate-700">Identifiant du modèle DocuSign</span>
                      <input
                        value={template.docusignTemplateId}
                        onChange={(event) =>
                          setTemplate((current) => (current ? { ...current, docusignTemplateId: event.target.value } : current))
                        }
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[12px] text-slate-900 outline-none transition focus:border-[#007cbd]"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[12px] font-medium text-slate-700">Nom du rôle signataire dans DocuSign</span>
                      <input
                        value={template.docusignTemplateRoleName}
                        onChange={(event) =>
                          setTemplate((current) => (current ? { ...current, docusignTemplateRoleName: event.target.value } : current))
                        }
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[12px] text-slate-900 outline-none transition focus:border-[#007cbd]"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold text-slate-950">DIP principal PDF</h3>
                      <p className="mt-1 text-[12px] leading-5 text-slate-500">
                        Ce fichier sera joint juste après l’accusé de réception DocuSign.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950">
                      {uploading === "main" ? "Import..." : template.mainDocument ? "Remplacer" : "Uploader"}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(event) => void handleUpload(event.target.files?.[0] ?? null, "main")}
                      />
                    </label>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {template.mainDocument ? (
                      <div className="flex items-center gap-3">
                        <a
                          href={template.mainDocument.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block min-w-0 flex-1 truncate text-[12px] font-medium text-slate-900 hover:text-[#007cbd]"
                        >
                          {template.mainDocument.fileName}
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDelete(template.mainDocument!.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-rose-600"
                          aria-label="Supprimer le DIP principal"
                          title="Supprimer le DIP principal"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400">Aucun DIP principal n’est encore uploadé.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Version</p>
                  <input
                    value={template.version}
                    onChange={(event) => setTemplate((current) => (current ? { ...current, version: event.target.value } : current))}
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[12px] text-slate-900 outline-none transition focus:border-[#007cbd]"
                  />
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold text-slate-950">Annexes PDF</h3>
                      <p className="mt-1 text-[12px] leading-5 text-slate-500">
                        Elles seront jointes après le DIP principal. L’ELM du candidat sera ajouté automatiquement au bon moment.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950">
                      {uploading === "annex" ? "Ajout..." : "Ajouter"}
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(event) => void handleUpload(event.target.files?.[0] ?? null, "annex")}
                      />
                    </label>
                  </div>

                  <div className="mt-4">
                    {template.annexes.length ? (
                      <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        {template.annexes.map((attachment) => (
                          <div key={attachment.id} className="flex items-center gap-2 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => void handleDelete(attachment.id)}
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-rose-600"
                              title="Supprimer l’annexe"
                              aria-label={`Supprimer ${attachment.fileName}`}
                            >
                              ×
                            </button>
                            <a
                              href={attachment.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block min-w-0 flex-1 truncate text-[12px] font-medium text-slate-900 hover:text-[#007cbd]"
                            >
                              {attachment.fileName}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400">Aucune annexe enregistrée.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-sm text-rose-600">{error ?? "Modèle DIP introuvable."}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

function EmailTemplateModal({
  slug,
  onClose
}: {
  slug: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<EmailTemplatePayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/email-templates/${slug}`);
        if (!response.ok) {
          throw new Error("Impossible de charger le template.");
        }
        const data = (await response.json()) as EmailTemplatePayload;
        if (!cancelled) {
          setTemplate(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger le template.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handleSave() {
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/email-templates/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: template.subject,
          bodyText: template.bodyText,
          bodyHtml: textToHtml(template.bodyText),
          isActive: template.isActive
        })
      });

      if (!response.ok) {
        throw new Error("Impossible d'enregistrer le template.");
      }

      const data = (await response.json()) as EmailTemplatePayload;
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/email-templates/${slug}`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Impossible d'ajouter la pièce jointe.");
      }

      const data = (await response.json()) as EmailTemplatePayload;
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter la pièce jointe.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    const confirmed = window.confirm("Supprimer cette pièce jointe ?");
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(`/api/admin/email-templates/${slug}?attachmentId=${attachmentId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Impossible de supprimer la pièce jointe.");
      }

      const data = (await response.json()) as EmailTemplatePayload;
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer la pièce jointe.");
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#007cbd]">Workflow mails</p>
            <h2 className="text-[18px] font-semibold text-slate-950">{getTemplateTitle(slug)}</h2>
            {!template?.transportConfigured ? (
              <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4.5 text-amber-900">
                Pour qu’un vrai mail parte, il faut aussi configurer un transport d’envoi dans le `.env` : SMTP Gmail/Google Workspace ou Resend.
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Chargement du template…</div>
        ) : template ? (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3">
              <label className="block space-y-2">
                <span className="text-[12px] font-medium text-slate-700">Objet du mail</span>
                <input
                  value={template.subject}
                  onChange={(event) => setTemplate((current) => (current ? { ...current, subject: event.target.value } : current))}
                  className="h-10 w-full rounded-2xl border border-slate-200 px-3.5 text-[12px] text-slate-900 outline-none transition focus:border-[#007cbd]"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-medium text-slate-700">Corps du mail</span>
                <textarea
                  value={template.bodyText}
                  onChange={(event) => setTemplate((current) => (current ? { ...current, bodyText: event.target.value } : current))}
                  className="min-h-[150px] w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-[12px] leading-5 text-slate-900 outline-none transition focus:border-[#007cbd]"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="rounded-2xl bg-white px-3 py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d7e9f4] bg-[#f4fafe]">
                      {template.signatureProfile.photoDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={template.signatureProfile.photoDataUrl}
                          alt="Photo signature"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#007cbd]">
                          {`${template.signatureProfile.firstname[0] ?? ""}${template.signatureProfile.lastname[0] ?? ""}`}
                        </span>
                      )}
                    </div>
                    <div className="min-h-[64px] w-px self-stretch bg-slate-200" />
                    <div className="space-y-0.5 text-[11px] leading-4.5 text-slate-700">
                      <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-950">
                        {template.signatureProfile.firstname} {template.signatureProfile.lastname}
                      </p>
                      <p className="italic text-[10px] text-slate-500">{template.signatureProfile.professionalRole}</p>
                      <p className="text-[#007cbd]">{template.signatureProfile.professionalEmail}</p>
                      <p>{template.signatureProfile.professionalPhone}</p>
                      <p>{template.brandName}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950">
                  {uploading ? "Ajout..." : "Ajouter une pièce jointe"}
                  <input type="file" className="hidden" onChange={handleUploadAttachment} />
                </label>

                <div className="mt-2.5 space-y-2">
                  {template.attachments.length ? (
                    template.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-slate-900">{attachment.fileName}</p>
                          <p className="text-[10px] text-slate-500">{attachment.mimeType || "Fichier joint"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAttachment(attachment.id)}
                          className="rounded-full bg-white px-3 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-8 text-sm text-rose-600">{error ?? "Template introuvable."}</div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3">
          <p className={`text-[12px] ${error ? "text-rose-600" : "text-slate-500"}`}>{error ?? ""}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !template}
              className="rounded-2xl bg-[#007cbd] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#00679d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewPageModal({
  title,
  href,
  onClose
}: {
  title: string;
  href: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#007cbd]">Aperçu candidat</p>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          >
            ×
          </button>
        </div>
        <iframe src={href} title={title} className="h-full w-full bg-white" />
      </div>
    </div>
  );
}

export function WorkflowBoard({
  sections
}: {
  sections: WorkflowSection[];
}) {
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState<string | null>(null);
  const [dipTemplateMode, setDipTemplateMode] = useState<"config" | null>(null);
  const [previewPage, setPreviewPage] = useState<{ title: string; href: string } | null>(null);

  const doneCount = sections.reduce((total, section) => total + section.items.filter((item) => item.done).length, 0);
  const totalCount = sections.reduce((total, section) => total + section.items.length, 0);
  const pendingCount = totalCount - doneCount;
  let globalItemIndex = 0;

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#007cbd]">Workflow</p>
              <h1 className="text-3xl font-semibold text-slate-950">Visualisation du workflow d'automatisation</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Cette page résume toutes les étapes du flux candidat actuellement en cours de paramétrage dans Zonara.
                Les éléments terminés apparaissent en vert uniquement lorsqu'ils sont réellement finalisés et opérationnels.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Éléments</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{totalCount}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">Terminés</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{doneCount}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-700">À finir</p>
                <p className="mt-2 text-2xl font-semibold text-rose-700">{pendingCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {sections.map((section, sectionIndex) => (
            <section key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#007cbd] text-sm font-semibold text-white">
                    {sectionIndex + 1}
                  </span>
                  <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {section.items.filter((item) => item.done).length}/{section.items.length}
                </span>
              </div>
              <div className="space-y-3">
                {section.items.map((item) => {
                  globalItemIndex += 1;
                  const content = (
                    <div
                      className={`rounded-2xl border px-4 py-3 ${
                        item.done ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                      } ${item.templateSlug || item.previewHref || item.dipTemplate ? "cursor-pointer transition hover:shadow-sm" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white/80 px-2 text-xs font-semibold text-slate-600">
                          {globalItemIndex}
                        </span>
                        <span
                          className={`mt-0.5 inline-flex min-w-[92px] justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                            item.done ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                          }`}
                        >
                          {item.done ? "Terminé" : "À faire"}
                        </span>
                        <div className="space-y-1">
                          <p className={`text-sm leading-6 ${item.done ? "text-emerald-950" : "text-rose-950"}`}>{item.label}</p>
                          {item.templateSlug ? <p className="text-xs text-slate-500">Cliquer pour paramétrer ce mail</p> : null}
                          {item.dipTemplate ? (
                            <p className="text-xs text-slate-500">Cliquer pour configurer le modèle DocuSign, le DIP PDF et les annexes</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );

                  if (!item.templateSlug && !item.previewHref && !item.dipTemplate) {
                    return <div key={item.label}>{content}</div>;
                  }

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        if (item.templateSlug) {
                          setSelectedTemplateSlug(item.templateSlug);
                          return;
                        }
                        if (item.previewHref) {
                          setPreviewPage({ title: item.label, href: item.previewHref });
                          return;
                        }
                        if (item.dipTemplate) {
                          setDipTemplateMode(item.dipTemplate);
                        }
                      }}
                      className="block w-full text-left"
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {selectedTemplateSlug ? <EmailTemplateModal slug={selectedTemplateSlug} onClose={() => setSelectedTemplateSlug(null)} /> : null}
      {dipTemplateMode ? <DipTemplateModal onClose={() => setDipTemplateMode(null)} /> : null}
      {previewPage ? <PreviewPageModal title={previewPage.title} href={previewPage.href} onClose={() => setPreviewPage(null)} /> : null}
    </>
  );
}
