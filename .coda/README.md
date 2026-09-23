# CODA generated output / CODA 生成输出

`.coda/generated/` is tool-owned and reproducible from `coda/events/`, the capability manifest, and the generator version. The directory is ignored by Git. A hand-edited generated file must be explicitly taken over or moved into an `escape` node; generators stop instead of overwriting it.

`.coda/generated/` 由工具管理，可以根据 `coda/events/`、能力清单和生成器版本复现。该目录被 Git 忽略。手动编辑的生成文件必须显式接管，或移动到 `escape` 节点中；生成器会停止，而不是直接覆盖它。

Regenerate / 重新生成：

```sh
npm run coda -- generate coda/events/ui.reward.apply.gse.json
```
