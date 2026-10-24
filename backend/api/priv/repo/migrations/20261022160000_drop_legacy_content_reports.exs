defmodule GroupherServer.Repo.Migrations.DropLegacyContentReports do
  use Ecto.Migration

  @cms "cms"
  @account "account"
  @reaction_tables ~w(
    post_reaction_infos
    blog_reaction_infos
    changelog_reaction_infos
    doc_reaction_infos
    comment_reaction_infos
  )a

  def up do
    execute("DROP TABLE IF EXISTS #{@cms}.abuse_reports")

    execute("UPDATE #{@cms}.comments SET meta = meta - 'report_count'")
    execute("UPDATE #{@account}.users SET meta = meta - 'reported_count' - 'reported_user_ids'")
    execute("UPDATE #{@account}.users SET contributes = contributes - 'reported_count'")

    Enum.each(@reaction_tables, fn table_name ->
      alter table(table_name, prefix: @cms) do
        remove(:reported_user_ids)
        add(:reports_count, :integer, null: false, default: 0)
      end
    end)
  end

  def down do
    raise "DropLegacyContentReports is irreversible; old Report storage is intentionally retired"
  end
end
