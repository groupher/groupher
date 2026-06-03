defmodule GroupherServer.Repo.Migrations.ReplaceDashboardFaqsWithDocFaq do
  use Ecto.Migration

  def up do
    alter table(:community_dashboards, prefix: "cms") do
      remove(:faqs)
      add(:doc_faq, :map)
    end
  end

  def down do
    alter table(:community_dashboards, prefix: "cms") do
      remove(:doc_faq)
      add(:faqs, {:array, :map})
    end
  end
end
