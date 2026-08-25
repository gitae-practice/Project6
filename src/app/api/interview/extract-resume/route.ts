import type { NextRequest } from "next/server";
import { anthropic, INTERVIEW_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";

interface ExtractResumeRequestBody {
  fileBase64: string; // PDF 파일을 base64로 인코딩한 문자열 (data: 접두사 제외)
}

// OCR 라이브러리를 따로 붙이지 않는다 — Claude가 PDF를 문서(document) 콘텐츠로
// 직접 이해할 수 있어서(레이아웃/표 포함), base64로 그대로 전달하면 된다.
export async function POST(request: NextRequest) {
  const { fileBase64 } = (await request.json()) as ExtractResumeRequestBody;

  if (!fileBase64) {
    return Response.json({ error: "파일 데이터가 없습니다." }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: INTERVIEW_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
            },
            {
              type: "text",
              text: "위 PDF는 지원자의 이력서입니다. 면접관이 참고할 수 있도록 주요 기술 스택, 경력 연차, 대표 프로젝트를 3~5문장으로 요약해주세요. 요약문만 출력하고 다른 설명은 붙이지 마세요.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const summary = textBlock?.type === "text" ? textBlock.text : "";

    if (!summary) {
      return Response.json({ error: "이력서 내용을 읽지 못했습니다." }, { status: 502 });
    }

    return Response.json({ summary });
  } catch {
    return Response.json({ error: "이력서 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
