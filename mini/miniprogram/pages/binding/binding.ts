import { applyLayout } from "../../utils/layout";
import {
  clearBindingChallenge,
  confirmBindingChallenge,
  inspectBindingChallenge,
  rejectBindingChallenge,
} from "../../utils/mini-binding";
import { adoptBoundMiniIdentity } from "../../utils/auth";
import { applyTheme, getCurrentDark } from "../../utils/page";

type BindingStatus =
  | "loading"
  | "pending"
  | "confirming"
  | "confirmed"
  | "rejecting"
  | "rejected"
  | "expired"
  | "replaced"
  | "consumed"
  | "conflict"
  | "error";

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

Page({
  data: {
    dark: getCurrentDark(),
    expanded: false,
    status: "loading" as BindingStatus,
    profileName: "",
    profileImage: "",
    expiresAt: "",
    conflictReason: "" as "" | "openid" | "target",
  },
  onLoad() {
    this.loadInspection();
  },
  onUnload() {
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    clearBindingChallenge();
  },
  onShow() {
    applyTheme.call(this);
    applyLayout.call(this);
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  onResize() {
    applyLayout.call(this);
  },
  async loadInspection() {
    this.setData({ status: "loading" });
    try {
      const result = await inspectBindingChallenge();
      if (result.status !== "pending" || !result.profile) {
        this.setData({ status: result.status, conflictReason: result.conflictReason ?? "" });
        return;
      }
      this.setData({
        status: "pending",
        profileName: result.profile.name,
        profileImage: result.profile.image ?? "",
        expiresAt: new Date(result.expiresAt).toLocaleTimeString(),
      });
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => this.loadInspection(), Math.max(0, result.expiresAt - Date.now()));
    } catch {
      this.setData({ status: "error" });
    }
  },
  async onReject() {
    if (this.data.status !== "pending") return;
    this.setData({ status: "rejecting" });
    try {
      const result = await rejectBindingChallenge();
      this.setData({ status: result.status });
    } catch {
      this.setData({ status: "error" });
    }
  },
  async onConfirm() {
    if (this.data.status !== "pending") return;
    this.setData({ status: "confirming" });
    try {
      const result = await confirmBindingChallenge();
      if (result.status === "confirmed" && result.identity) {
        if (!adoptBoundMiniIdentity(result.identity)) throw new Error("Invalid identity response");
        this.setData({ status: "confirmed" });
        return;
      }
      this.setData({ status: result.status, conflictReason: result.conflictReason ?? "" });
    } catch {
      this.setData({ status: "error" });
    }
  },
  onRetry() {
    this.loadInspection();
  },
  onBack() {
    wx.navigateBack();
  },
});
