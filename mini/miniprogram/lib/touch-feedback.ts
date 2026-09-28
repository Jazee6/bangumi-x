export function vibrateForRecordChange() {
  wx.vibrateShort({ type: "light", fail: () => {} });
}
