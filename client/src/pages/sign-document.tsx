import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertCircle, PenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";

interface SigningInfo {
  documentType: string;
  clientName: string;
  sentAt: string;
  signedAt: string | null;
  signerName: string | null;
  alreadySigned: boolean;
}

const DOC_LABELS: Record<string, { title: string; description: string; legal: string }> = {
  fdd_receipt: {
    title: "FDD Receipt",
    description: "Franchise Disclosure Document Receipt",
    legal: "By signing below, I acknowledge that I have received and had the opportunity to review the Franchise Disclosure Document (FDD) from New Dawn Franchising LLC. I understand that federal law requires a 14-day waiting period after receipt before I may sign any franchise agreement or pay any fees.",
  },
  franchise_agreement: {
    title: "Franchise Agreement",
    description: "New Dawn Franchising Franchise Agreement",
    legal: "By signing below, I agree to be bound by the terms and conditions of the Franchise Agreement with New Dawn Franchising LLC, and confirm that I have reviewed the document in full and have had sufficient time to seek independent legal advice.",
  },
};

export default function SignDocumentPage() {
  const [, params] = useRoute("/sign/:token");
  const token = params?.token || "";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signMode, setSignMode] = useState<"draw" | "type">("draw");
  const [typedSig, setTypedSig] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const { data: info, isLoading, error } = useQuery<SigningInfo>({
    queryKey: [`/api/sign/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/sign/${token}`);
      if (!res.ok) throw new Error("Link not found or expired");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const docInfo = info ? (DOC_LABELS[info.documentType] || DOC_LABELS.fdd_receipt) : null;

  // Canvas drawing
  useEffect(() => {
    if (signMode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0a1628";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [signMode]);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function stopDraw() { setIsDrawing(false); }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function getSignatureData(): string {
    if (signMode === "type") {
      if (!typedSig.trim()) return "";
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 120;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 600, 120);
      ctx.fillStyle = "#0a1628";
      ctx.font = "italic 52px 'Georgia', serif";
      ctx.textBaseline = "middle";
      ctx.fillText(typedSig, 20, 60);
      return canvas.toDataURL("image/png");
    }
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  }

  const canSign = signerName.trim().length >= 2 && agreed && (signMode === "draw" ? hasDrawn : typedSig.trim().length >= 2);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim(), signatureData: getSignatureData() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Signing failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSignedAt(data.signedAt);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f8]">
        <Loader2 className="size-8 animate-spin text-[#0a1628]" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f8] p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="size-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link Not Found</h1>
          <p className="text-gray-500 text-sm">This signing link is invalid or has expired. Please contact New Dawn Franchising for assistance.</p>
          <p className="text-gray-400 text-xs mt-4">dylan@newdawnfranchising.com</p>
        </div>
      </div>
    );
  }

  const alreadySigned = info.alreadySigned || !!signedAt;
  const finalSignedAt = signedAt || info.signedAt;
  const finalSignerName = submitMutation.isSuccess ? signerName : info.signerName;

  return (
    <div className="min-h-screen bg-[#f5f6f8] flex flex-col">
      {/* Header */}
      <header className="bg-[#0a1628] text-white py-4 px-6 flex items-center justify-between shadow-md">
        <div>
          <p className="text-[#c9a84c] font-bold text-lg tracking-wide">NEW DAWN FRANCHISING</p>
          <p className="text-[#8899aa] text-xs">Group of Companies™</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#8899aa]">Secure Document Signing</p>
          <p className="text-xs text-[#8899aa] mt-0.5">🔒 Encrypted</p>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">

          {/* Document Card */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {/* Doc header */}
            <div className="bg-[#f8f9fa] border-b px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-[#0a1628] flex items-center justify-center shrink-0">
                  <PenLine className="size-6 text-[#c9a84c]" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Document for Signature</p>
                  <h1 className="text-xl font-bold text-[#0a1628]">{docInfo?.title}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">{docInfo?.description}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Client info */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Prepared For</p>
                  <p className="font-semibold text-[#0a1628]">{info.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Sent On</p>
                  <p className="font-semibold text-[#0a1628]">{new Date(info.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                </div>
                {alreadySigned && finalSignedAt && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Signed On</p>
                    <p className="font-semibold text-green-700">{new Date(finalSignedAt).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                )}
              </div>

              {alreadySigned ? (
                /* ── Already signed ── */
                <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
                  <CheckCircle2 className="size-12 text-green-500 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-green-800 mb-1">Document Signed</h2>
                  <p className="text-green-700 text-sm mb-2">
                    This document was signed by <strong>{finalSignerName}</strong>
                  </p>
                  {finalSignedAt && (
                    <p className="text-green-600 text-xs">
                      {new Date(finalSignedAt).toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
                    </p>
                  )}
                  <p className="text-gray-500 text-xs mt-4">A copy of this record has been retained by New Dawn Franchising. Please contact us if you have any questions.</p>
                </div>
              ) : (
                /* ── Signing form ── */
                <div className="space-y-5">
                  {/* Legal text */}
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
                    <p className="text-sm text-blue-900 leading-relaxed">{docInfo?.legal}</p>
                  </div>

                  {/* Typed name */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Your Full Legal Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Type your full legal name"
                      className="text-base"
                    />
                  </div>

                  {/* Signature method toggle */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Signature <span className="text-red-500">*</span>
                    </label>
                    <div className="flex rounded-lg border overflow-hidden mb-3">
                      <button
                        onClick={() => setSignMode("draw")}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${signMode === "draw" ? "bg-[#0a1628] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                      >
                        Draw
                      </button>
                      <button
                        onClick={() => setSignMode("type")}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${signMode === "type" ? "bg-[#0a1628] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                      >
                        Type
                      </button>
                    </div>

                    {signMode === "draw" ? (
                      <div className="relative">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={150}
                          className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 cursor-crosshair touch-none"
                          style={{ height: "150px" }}
                          onMouseDown={startDraw}
                          onMouseMove={draw}
                          onMouseUp={stopDraw}
                          onMouseLeave={stopDraw}
                          onTouchStart={startDraw}
                          onTouchMove={draw}
                          onTouchEnd={stopDraw}
                        />
                        <p className="text-xs text-gray-400 mt-1 text-center">Draw your signature in the box above</p>
                        {hasDrawn && (
                          <button
                            onClick={clearCanvas}
                            className="absolute top-2 right-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 bg-white border rounded px-2 py-1"
                          >
                            <RotateCcw className="size-3" /> Clear
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <Input
                          value={typedSig}
                          onChange={(e) => setTypedSig(e.target.value)}
                          placeholder="Type your signature"
                          className="text-2xl italic font-serif h-14"
                          style={{ fontFamily: "Georgia, serif" }}
                        />
                        <p className="text-xs text-gray-400 mt-1">Your typed name will be used as your electronic signature</p>
                      </div>
                    )}
                  </div>

                  {/* Agreement checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 size-4 accent-[#0a1628] cursor-pointer"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                      I agree that this electronic signature is legally binding and equivalent to my handwritten signature. I have read and understood the document above.
                    </span>
                  </label>

                  {submitMutation.isError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                      <p className="text-sm text-red-700">{(submitMutation.error as Error)?.message || "An error occurred. Please try again."}</p>
                    </div>
                  )}

                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={!canSign || submitMutation.isPending}
                    className="w-full h-12 text-base bg-[#0a1628] hover:bg-[#1a2638] gap-2"
                  >
                    {submitMutation.isPending ? (
                      <><Loader2 className="size-5 animate-spin" /> Submitting…</>
                    ) : (
                      <><PenLine className="size-5" /> Sign Document</>
                    )}
                  </Button>
                  <p className="text-xs text-gray-400 text-center">
                    Your IP address and timestamp will be recorded as part of this electronic signature.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            New Dawn Franchising LLC · El Paso, TX · dylan@newdawnfranchising.com<br />
            This is a legally binding electronic document. For questions call or email us directly.
          </p>
        </div>
      </main>
    </div>
  );
}
