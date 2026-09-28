import { createFileRoute } from "@tanstack/react-router";

import { TrustPage, TrustSection } from "@/components/trust-page";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/_trust/privacy")({
  head: () =>
    buildPageHead({
      title: "隐私说明",
      description:
        "Bangumi X 的登录、微信小程序身份、资料审核、公开列表、基础日志、动态分享图片字体请求与分析脚本说明。",
      canonicalPath: "/privacy",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <TrustPage title="隐私说明">
      <TrustSection title="身份与功能数据">
        <p>登录由身份提供方完成。本站保存维持会话、站内显示名、收藏与进度所需的数据。</p>
        <p>
          在番迹微信小程序中，只有用户主动设置资料或关联账号时才会调用微信登录。服务端会保存该小程序下的微信
          OpenID、内部占位邮箱和会话；公开内容浏览不会创建微信用户。
        </p>
        <p>
          用户提交的显示名和头像会发送至微信内容安全接口审核。头像候选文件及审核通过后生成的 WebP
          文件存储在 Cloudflare R2；未通过或过期的候选文件会删除。
        </p>
        <p>
          用户在小程序确认合并后，微信用户会不可逆地并入 Bangumi X
          用户；收藏、进度与收藏列表按确认页所示规则合并，并永久保存最小合并审计记录。
        </p>
        <p>会话和侧栏状态等 Cookie 或本地存储只用于登录与界面功能，不用于广告画像。</p>
      </TrustSection>
      <TrustSection title="公开收藏列表">
        <p>
          只有用户主动设为公开的列表可以通过分享链接访问；名称有效且至少包含三个条目时，列表才可能进入搜索索引。
          改回私密或删除后，公开访问与索引目录会撤回；边缘缓存中的既有内容最多可能延迟五分钟失效。
        </p>
      </TrustSection>
      <TrustSection title="基础设施与字体">
        <p>EdgeOne Pages 与 Cloudflare 可能为安全、运维和故障排查保留必要的基础访问日志。</p>
        <p>
          服务端生成公开 Open Graph 分享图片时，会向 Google Fonts
          请求图片中文字实际需要的公开字形；不会发送邮箱、会话或私密内容。
        </p>
      </TrustSection>
      <TrustSection title="不进行行为追踪">
        <p>本站不接入 GA4、GTM、客户端 Web Analytics、广告脚本或会话回放。</p>
      </TrustSection>
    </TrustPage>
  );
}
