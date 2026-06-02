defmodule GroupherServer.Repo.Migrations.ReplaceDashboardFaqsWithDocFaq do
  use Ecto.Migration

  def change do
    alter table(:community_dashboards, prefix: "cms") do
      remove(:faqs)
      add(:doc_faq, :map)
    end
  end
end
