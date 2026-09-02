// 이력서/포트폴리오 PDF 업로드 공통 로직 — 파일 검증 + base64 변환 + /api/interview/extract-pdf 호출.
// 두 업로드가 완전히 같은 처리 방식(문서 그대로 Claude에게 읽혀서 텍스트로 추출)이라 하나로 합쳤다.

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? ""); // data: 접두사는 잘라낸다
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export async function extractPdfText(file: File, kind: "resume" | "portfolio"): Promise<string> {
  if (file.type !== "application/pdf") {
    throw new Error("PDF 파일만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("파일이 너무 큽니다 (10MB 이하).");
  }

  const fileBase64 = await fileToBase64(file);
  const response = await fetch("/api/interview/extract-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, kind }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    const fallback = kind === "resume" ? "이력서 분석에 실패했습니다." : "포트폴리오 분석에 실패했습니다.";
    throw new Error(data?.error ?? fallback);
  }

  const data = (await response.json()) as { content: string };
  return data.content;
}
