defmodule GroupherServer.Test.CMS.Tickets.MigrationPreflightTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  alias CMS.Model.Article
  alias GroupherServer.Repo

  test "TicketSource cutover preflight rejects residual Article data before DDL" do
    {_community, post, _attrs, _actor} = mock_article(:post)

    migration_path =
      Path.expand(
        "../../../../priv/repo/migrations/20261101140000_replace_ticket_posts_with_sources.exs",
        __DIR__
      )

    migration_source = File.read!(migration_path)

    assert [_, preflight_template] =
             Regex.run(~r/execute\(\"\"\"\s*(DO \$\$.*?\$\$)\s*\"\"\"\)/s, migration_source)

    preflight_sql = String.replace(preflight_template, "\#{@cms}", "cms")

    assert {:ok, _} =
             Repo.transaction(fn ->
               Repo.query!("CREATE TABLE cms.ticket_posts (id uuid PRIMARY KEY)")
               Repo.query!("SAVEPOINT ticket_source_cutover_preflight")

               error =
                 assert_raise Postgrex.Error, fn ->
                   Repo.query!(preflight_sql)
                 end

               assert Exception.message(error) =~
                        "ticket_v2_article_cutover_requires_content_reset"

               Repo.query!("ROLLBACK TO SAVEPOINT ticket_source_cutover_preflight")
               Repo.query!("RELEASE SAVEPOINT ticket_source_cutover_preflight")

               assert Repo.get(Article, post.id)
             end)
  end
end
