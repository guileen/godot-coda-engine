/**
 * CODA 的无 Godot 确定性构建核心。
 * EventAsset 是事实源；Godot 只消费生成 runner、runtime ABI 和编辑器适配层。
 */
export const CONTRACT_VERSION = 1;
export * from "./gseos/index.js";
