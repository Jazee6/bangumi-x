import type { MiniAccountLinkPreview } from "share";

import {
  cancelMiniAccountLink,
  claimMiniAccountLink,
  clearPendingAccountLink,
  confirmMiniAccountLink,
  finishMiniAccountLink,
  getMiniAccountLinkPreview,
  getPendingAccountLink,
  getMiniIdentity,
  isAccountLinkRecoverableError,
} from "../../../../lib/mini-identity";
import { getErrorMessage, PublicApiError } from "../../../../lib/request";

const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function formatShortCode(value: string) {
  const compact = Array.from(value.toUpperCase())
    .filter((character) => SHORT_CODE_ALPHABET.includes(character))
    .slice(0, 8)
    .join("");
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

Component({
  data: {
    cancelling: false,
    claimToken: "",
    claiming: false,
    codeInput: "",
    eligible: true,
    errorMessage: "",
    finalizing: false,
    loaded: false,
    loading: true,
    preview: null as MiniAccountLinkPreview | null,
  },

  lifetimes: {
    attached() {
      void this.initialize();
    },
  },

  methods: {
    onRetry() {
      void this.initialize();
    },

    onCodeInput(event: WechatMiniprogram.Input) {
      this.setData({ codeInput: formatShortCode(event.detail.value) });
    },

    onSubmitCode() {
      if (this.data.codeInput.replace("-", "").length !== 8) {
        wx.showToast({ title: "请输入完整的 8 位短码", icon: "none" });
        return;
      }
      void this.claimCredential(this.data.codeInput);
    },

    onScanCode() {
      if (this.data.claiming) return;
      wx.scanCode({
        scanType: ["qrCode"],
        success: (result) => {
          void this.claimCredential(result.result);
        },
        fail: (error) => {
          if (!error.errMsg.includes("cancel")) {
            wx.showToast({ title: "二维码扫描失败", icon: "none" });
          }
        },
      });
    },

    async onContinueConfirm() {
      const { claimToken, preview } = this.data;
      if (!claimToken || !preview || this.data.finalizing) return;
      const { confirm } = await wx.showModal({
        title: "最后确认",
        content: `确认后，当前微信用户将被不可逆地并入“${preview.target.name}”。此操作无法撤销。`,
        confirmText: "确认合并",
      });
      if (confirm && this.data.claimToken === claimToken && this.data.preview === preview) {
        void this.completeMerge();
      }
    },

    onCancelClaim() {
      void this.cancelClaim();
    },

    async initialize() {
      this.setData({ errorMessage: "", loading: true });
      try {
        const pending = getPendingAccountLink();
        if (pending) {
          const result = await finishMiniAccountLink(pending.claimToken);
          if (result.state === "complete") {
            this.showMergeSuccess();
            return;
          }
          if (result.state === "failed") {
            clearPendingAccountLink();
            wx.showToast({ title: result.message ?? "用户合并未完成", icon: "none" });
          }
        }

        const user = await getMiniIdentity();
        if (!user.editable) {
          clearPendingAccountLink();
          this.setData({ eligible: false, loaded: true, loading: false });
          return;
        }

        const activePending = getPendingAccountLink();
        if (!activePending) {
          this.setData({ eligible: true, loaded: true, loading: false, preview: null });
          return;
        }

        const preview = await getMiniAccountLinkPreview(activePending.claimToken);
        this.setData({
          claimToken: activePending.claimToken,
          eligible: true,
          loaded: true,
          loading: false,
          preview,
        });
      } catch (error) {
        if (
          error instanceof PublicApiError &&
          (error.code === "MINI_ACCOUNT_LINK_EXPIRED" ||
            error.code === "MINI_ACCOUNT_LINK_NOT_FOUND")
        ) {
          clearPendingAccountLink();
        }
        this.setData({
          errorMessage: getErrorMessage(error),
          loaded: false,
          loading: false,
        });
      }
    },

    async claimCredential(credential: string) {
      if (this.data.claiming) return;
      this.setData({ claiming: true, errorMessage: "" });
      try {
        const claim = await claimMiniAccountLink(credential);
        this.setData({
          claimToken: claim.claimToken,
          preview: claim.preview,
        });
      } catch (error) {
        wx.showToast({ title: getErrorMessage(error), icon: "none" });
      } finally {
        this.setData({ claiming: false });
      }
    },

    async completeMerge() {
      const { claimToken, preview } = this.data;
      if (!claimToken || !preview || this.data.finalizing) return;
      this.setData({ finalizing: true });
      try {
        await confirmMiniAccountLink(claimToken, preview.previewVersion);
        const result = await finishMiniAccountLink(claimToken);
        if (result.state !== "complete") throw new Error("用户合并结果尚未就绪，请重试。");
        this.showMergeSuccess();
      } catch (error) {
        let actionableError = error;
        if (error instanceof PublicApiError && error.code === "MINI_ACCOUNT_LINK_CHANGED") {
          try {
            const refreshed = await getMiniAccountLinkPreview(claimToken);
            this.setData({ preview: refreshed });
            wx.showToast({ title: "个人数据已有变化，请重新确认", icon: "none" });
            return;
          } catch (refreshError) {
            actionableError = refreshError;
          }
        }
        if (isAccountLinkRecoverableError(actionableError)) {
          try {
            const result = await finishMiniAccountLink(claimToken);
            if (result.state === "complete") {
              this.showMergeSuccess();
              return;
            }
          } catch {
            // Fall through to the original actionable error.
          }
        }
        wx.showToast({ title: getErrorMessage(actionableError), icon: "none" });
      } finally {
        this.setData({ finalizing: false });
      }
    },

    async cancelClaim() {
      const { claimToken } = this.data;
      if (!claimToken || this.data.cancelling) return;
      this.setData({ cancelling: true });
      try {
        await cancelMiniAccountLink(claimToken);
        this.setData({ claimToken: "", preview: null });
        wx.showToast({ title: "已取消本次用户合并", icon: "none" });
      } catch (error) {
        wx.showToast({ title: getErrorMessage(error), icon: "none" });
      } finally {
        this.setData({ cancelling: false });
      }
    },

    showMergeSuccess() {
      this.triggerEvent("complete");
    },
  },
});
