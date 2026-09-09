import type { Metadata } from "next";
import { PeelTest } from "@/components/peel-test/peel-test";
import { TestFrame } from "@/components/peel-test/test-frame";
import { getPeelTest } from "@/lib/data";
import { peelTestMeta } from "@/lib/seo";

/**
 * 까주기 테스트 표지·문항 (spec 8 · design 화면 11). 콘텐츠가 설정값이라 **시간에 안 걸린다** —
 * 홈·상세와 달리 `connection()`이 없고 빌드 시 정적으로 굳는다.
 */
export async function generateMetadata(): Promise<Metadata> {
  return peelTestMeta(await getPeelTest());
}

export default async function TestPage() {
  const content = await getPeelTest();
  return (
    <TestFrame>
      <PeelTest content={content} />
    </TestFrame>
  );
}
