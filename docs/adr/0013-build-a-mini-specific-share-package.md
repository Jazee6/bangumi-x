# Build a Mini-specific share package

微信开发者工具只打包 `miniprogramRoot`，不能直接执行工作区 `share` 暴露的 TypeScript 源码。`share` 保留源码入口供 Web、Server 和现有测试直接消费，同时额外构建 CommonJS 与类型声明，并通过包的 `miniprogram` 入口和开发者工具的手动 npm 构建产出 Mini 可加载的 `miniprogram_npm`；这样不改变现有端的开发流程，也不需要复制契约或新增打包依赖。

`share/dist` 与 `mini/miniprogram/miniprogram_npm` 都是可重复生成且不入库的构建物，仓库提供统一的 Mini 准备命令。若微信开发者工具不能跟随工作区符号链接，再由该命令把已构建的包物理暂存到 Mini 的依赖目录，而不改为手工维护契约副本。
