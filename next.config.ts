import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 모드에서 뜨는 좌측 하단 "N" 인디케이터 숨김 (빌드/런타임 에러는 그대로 표시됨)
  devIndicators: false,
};

export default nextConfig;
