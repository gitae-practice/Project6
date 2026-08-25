import { z } from "zod";

// 면접 종료 후 종합 평가 리포트의 구조.
// Claude가 이 스키마에 맞춰 JSON으로 답하도록 강제한다 (output_config.format).
export const InterviewReportSchema = z.object({
  overall_score: z
    .number()
    .describe("10점 만점 종합 점수 (소수점 1자리까지)"),
  summary: z.string().describe("전체 면접에 대한 2~3문장 총평"),
  interviewer_feedback: z.object({
    technical: z.string().describe("기술 면접관 관점의 피드백 1~2문장"),
    personality: z.string().describe("인성 면접관 관점의 피드백 1~2문장"),
    pressure: z.string().describe("압박 면접관 관점의 피드백 1~2문장"),
  }),
  strengths: z.array(z.string()).describe("답변에서 드러난 강점 목록 (2~4개)"),
  improvements: z.array(z.string()).describe("보완이 필요한 부분 목록 (2~4개)"),
});

export type InterviewReport = z.infer<typeof InterviewReportSchema>;
