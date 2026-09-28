import { createFileRoute } from "@tanstack/react-router";

import { TrustPage, TrustSection } from "@/components/trust-page";
import { buildPageHead } from "@/lib/seo";

export const Route = createFileRoute("/_trust/about")({
  head: () =>
    buildPageHead({
      title: "关于",
      description:
        "了解 Bangumi X 的每日放送、本年度热门、排行榜、评分、数据来源、许可与维护责任。",
      canonicalPath: "/about",
    }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <TrustPage title="关于">
      <TrustSection title="Bangumi X 是什么">
        <p>
          Bangumi X 是由 Jazee6
          维护的非官方、非商业项目，以每日放送与发现为中心，并提供个人收藏与进度工具。 本站不是
          Bangumi 官方产品。
        </p>
      </TrustSection>
      <TrustSection title="公开集合如何形成">
        <p>每日放送表示每周固定星期的编排，不是某个日期的实际播出记录。</p>
        <p>
          本年度热门按当前自然年、所选条目类型筛选，并要求具有有效的 Bangumi
          全站排名；排行榜按首播年份与季度组织动画。
        </p>
        <p>
          页面中的评分来自
          Bangumi；获取时间表示本站实际取得或验证来源数据的时间，而不是页面访问时间。
        </p>
      </TrustSection>
      <TrustSection title="来源与许可">
        <p>
          条目资料、封面、简介、章节与角色信息来自
          <a
            className="text-primary mx-1 underline"
            href="https://bgm.tv"
            target="_blank"
            rel="noreferrer noopener"
          >
            Bangumi
          </a>
          ，依 CC BY-SA 3.0 提供；相关作品版权归各自创作者与权利人所有。
        </p>
        <p>本站仅保存服务与公开索引所需的最小数据，不建立 Bangumi 全量资料镜像。</p>
      </TrustSection>
      <TrustSection title="维护与源码">
        <p>
          维护者：
          <a
            className="text-primary underline"
            href="https://github.com/Jazee6"
            target="_blank"
            rel="noreferrer noopener"
          >
            Jazee6
          </a>
          。源码位于
          <a
            className="text-primary ml-1 underline"
            href="https://github.com/Jazee6/bangumi-x"
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub
          </a>
          。
        </p>
      </TrustSection>
    </TrustPage>
  );
}
