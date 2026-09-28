import { createFileRoute } from "@tanstack/react-router";

import { TrustPage, TrustSection } from "@/components/trust-page";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/_trust/terms")({
  head: () =>
    buildPageHead({
      title: "服务条款",
      description: "Bangumi X 的非商业性质、上游可用性、公开列表责任、禁止滥用与内容撤回说明。",
      canonicalPath: "/terms",
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <TrustPage title="服务条款">
      <TrustSection title="服务性质">
        <p>
          Bangumi X
          是非商业项目，不含广告、赞助位或付费功能。未来商业化前必须重新评审数据与内容许可。
        </p>
      </TrustSection>
      <TrustSection title="可用性与准确性">
        <p>
          公开事实依赖 Bangumi
          等上游服务，可能出现延迟、中断或暂时陈旧。来源获取时间用于帮助判断数据新鲜度。
        </p>
      </TrustSection>
      <TrustSection title="公开内容责任">
        <p>
          用户应确保公开收藏列表名称与整理内容合法、适当，不侵犯他人权利，也不公开不必要的个人信息。
        </p>
      </TrustSection>
      <TrustSection title="禁止滥用与撤回">
        <p>不得利用本站攻击服务、规避访问限制、批量镜像上游资料或实施违法活动。</p>
        <p>维护者可以为安全、许可、隐私或权利请求撤回公开内容；服务按现状提供，不保证持续可用。</p>
      </TrustSection>
    </TrustPage>
  );
}
