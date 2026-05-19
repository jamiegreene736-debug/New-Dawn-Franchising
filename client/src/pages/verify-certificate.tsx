import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { CheckCircle2, XCircle, Loader2, Award } from "lucide-react";
import logo from "@assets/Gemini_Generated_Image_t1u2o5t1u2o5t1u2_1771946732580.png";

interface CertInfo {
  valid: boolean;
  verificationId?: string;
  franchiseeName?: string;
  certType?: string;
  issuedAt?: string;
}

export default function VerifyCertificate() {
  const [, params] = useRoute("/verify/:verificationId");
  const [info, setInfo] = useState<CertInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.verificationId) return;
    fetch(`/api/franchisee/verify/${params.verificationId}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ valid: false }))
      .finally(() => setLoading(false));
  }, [params?.verificationId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4">
        <a href="/"><img src={logo} alt="New Dawn Franchising" className="h-12 w-auto" /></a>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-lg border p-8 text-center">
            {loading ? (
              <>
                <Loader2 className="size-10 animate-spin text-blue-400 mx-auto mb-4" />
                <p className="text-gray-500">Verifying certificate...</p>
              </>
            ) : info?.valid ? (
              <>
                <div className="inline-flex items-center justify-center size-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle2 className="size-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Certificate Verified</h1>
                <p className="text-green-600 text-sm font-medium mb-6">This certificate is authentic.</p>
                <div className="rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 p-6 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <Award className="size-8 text-yellow-600" />
                    <div>
                      <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">New Dawn Franchising LLC</p>
                      <p className="font-bold text-gray-900">{info.certType}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Awarded to</span>
                      <span className="font-semibold text-gray-900">{info.franchiseeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Issue date</span>
                      <span className="font-semibold text-gray-900">
                        {info.issuedAt ? new Date(info.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Verification ID</span>
                      <span className="font-mono text-xs text-gray-600">{info.verificationId?.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  Issued by New Dawn Franchising LLC · newdawnfranchising.com
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center size-16 rounded-full bg-red-100 mb-4">
                  <XCircle className="size-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Certificate Not Found</h1>
                <p className="text-gray-500">This verification ID is invalid or the certificate does not exist.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
