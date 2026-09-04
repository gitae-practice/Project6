"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ReportCard } from "@/components/ReportCard";
import { InterviewTranscript } from "@/components/InterviewTranscript";
import { groupMessagesByRole, type ChatTurn } from "@/lib/interview/transcript";
import type { InterviewerRole } from "@/lib/interview/roles";
import { formatAdminDate, type AdminSessionDetail } from "@/lib/admin";

// admin_get_session_detail() RPC가 그대로 내려주는 원본 모양 — messages는 평평한 배열이라
// 화면에서 쓰기 전에 groupMessagesByRole로 역할별로 묶어야 한다.
interface RawSessionDetail {
  session_id: string;
  masked_email: string;
  job_role: string | null;
  created_at: string;
  report: AdminSessionDetail["report"];
  messages: { interviewer_role: InterviewerRole; sender: ChatTurn["role"]; content: string }[];
}

// 세션 하나의 리포트 + 대화 전문을 보여주는 모달.
// 세션 관리 탭에서 직접 열리기도 하고, 유저 모달(UserSessionsModal)에서 한 단계 더 들어갈 때도 쓰인다.
export function SessionDetailModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // sessionId가 바뀔 때마다 이 컴포넌트를 새로 마운트시키는 건 호출부(key={sessionId})의 몫이라,
    // 여기서는 상태 초기화를 다시 할 필요 없이(useState 초기값이 이미 null/true) 곧바로 요청만 보낸다.
    let cancelled = false;
    const supabase = createClient();
    supabase
      .rpc("admin_get_session_detail", { target_session_id: sessionId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          const raw = data as RawSessionDetail;
          setDetail({
            session_id: raw.session_id,
            masked_email: raw.masked_email,
            job_role: raw.job_role,
            created_at: raw.created_at,
            report: raw.report,
            history: groupMessagesByRole(raw.messages),
          });
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="font-semibold">면접 상세</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && <p className="py-8 text-center text-sm text-muted">불러오는 중...</p>}
          {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
          {detail && (
            <div className="flex flex-col gap-6 text-left">
              <div>
                <p className="text-xs text-muted">
                  {detail.masked_email} · {formatAdminDate(detail.created_at)}
                </p>
                <h2 className="text-lg font-bold">{detail.job_role || "직무 미입력"}</h2>
              </div>

              {detail.report ? (
                <ReportCard report={detail.report} />
              ) : (
                <p className="text-sm text-muted">아직 진행 중인 면접입니다 (리포트가 생성되지 않았습니다).</p>
              )}

              <InterviewTranscript history={detail.history} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
