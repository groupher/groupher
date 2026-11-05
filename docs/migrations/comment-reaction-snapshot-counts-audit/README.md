# Comments B0 审计输入

> 状态：current

本目录保存审计材料，不是业务 checkout；`.ex.txt` 等正文副本不参与编译或运行。本轮只读源码、写文档，未干预其他 session。

- `20261105T074643Z`：预捕获，46 项正文；保留历史，不作为本轮最终范围。
- [20261105T074802Z manifest](20261105T074802Z/manifest.json)：本轮固定输入；49 项正文、SHA 和全范围路径指纹。正文路径由每项 content_path 给出，缺失文件以 deleted/NULL 表达；本次没有删除项。
- [review JSON](review-20261105T074802Z.json)：49 项 ledger/case、分类与静态结论；manifest 本身也有 SHA。
- [固定输入复核](../comment-reaction-snapshot-counts-snapshot-review.md)：人读结论与剩余设计/验收差异。
- `after-*`：捕获后工作区的时间点观察。新的正文/patch 不覆盖原快照；未复核项不能据此算通过。

捕获过程：读取旧 manifest 路径集及明确 backend 相关 Git 脏文件/未跟踪路径，保留旧基线缺覆盖的分类；保存正文前后复读字节及路径集一致；在独立文档目录写入正文和 manifest。该过程给出观测稳定窗口，不声称文件系统原子快照、全仓审计或已通过业务测试。

验证副本（仓库根目录，只读）：

```python
from pathlib import Path
import hashlib, json

root = Path("docs/migrations/comment-reaction-snapshot-counts-audit/20261105T074802Z")
manifest = json.loads((root / "manifest.json").read_text())
for row in manifest["review_inputs"]:
    if row["content_path"] is not None:
        body = (root / row["content_path"]).read_bytes()
        assert hashlib.sha256(body).hexdigest() == row["sha256"], row["path"]
print("Frozen payload verified:", manifest["review_input_count"])
```

旧 baseline JSON 不含正文，只能发现变化，不能恢复旧逐行 diff。新快照为本轮复核输入保留完整正文；scope_inventory 中未入选的未变文件只保存哈希，不能将这些文件称为已逐项复核。未来新增输入需单独捕获正文与时间，不往本 manifest 追加或覆盖。
