defmodule GroupherServer.Repo.Migrations.AddRootCommentIdToComments do
  use Ecto.Migration

  def change do
    # 尝试添加 root_comment_id 字段，如果表不存在会失败，忽略失败
    try do
      alter table(:comments, prefix: "cms") do
        add(:root_comment_id, :integer, null: true)
      end

      # 添加索引以提高查询性能
      create(index(:comments, [:root_comment_id], prefix: "cms"))
    rescue
      _ ->
        # 表不存在，忽略错误
        :ok
    end
  end
end
