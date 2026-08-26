import type { NextRequest } from "next/server";
import { anthropic, INTERVIEW_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface ExtractResumeRequestBody {
  fileBase64: string; // PDF 파일을 base64로 인코딩한 문자열 (data: 접두사 제외)
}

// OCR 라이브러리를 따로 붙이지 않는다 — Claude가 PDF를 문서(document) 콘텐츠로
// 직접 이해할 수 있어서(레이아웃/표 포함), base64로 그대로 전달하면 된다.
// 요약이 아니라 "텍스트 추출"을 시킨다 — 3~5문장으로 압축하면 프로젝트명, 세부 경험 같은
// 구체적인 내용이 날아가서 면접관이 덜 구체적인 질문을 하게 되기 때문.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { fileBase64 } = (await request.json()) as ExtractResumeRequestBody;

  if (!fileBase64) {
    return Response.json({ error: "파일 데이터가 없습니다." }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: INTERVIEW_MODEL,
      max_tokens: 2048,
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
              text: "위 PDF는 지원자의 이력서입니다. 안에 담긴 내용(경력, 프로젝트명, 기술 스택, 성과 등)을 요약하지 말고 최대한 빠짐없이 텍스트로 옮겨주세요. 불필요한 서식이나 반복되는 머리말/꼬리말은 정리해도 되지만, 실질적인 내용은 원문 그대로 유지해주세요. 결과 텍스트만 출력하고 다른 설명은 붙이지 마세요.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const content = textBlock?.type === "text" ? textBlock.text : "";

    if (!content) {
      return Response.json({ error: "이력서 내용을 읽지 못했습니다." }, { status: 502 });
    }

    return Response.json({ content });
  } catch {
    return Response.json({ error: "이력서 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
