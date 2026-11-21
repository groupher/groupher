# This integration probe can only write to the named disposable production clone.
# Real browser/service authentication is a separate production acceptance step.
import ExUnit.Assertions
import GroupherServer.Support.Factory
import Ecto.Query
alias GroupherServer.{CMS, Repo}

alias CMS.Model.{
  Article,
  ArticleBody,
  ArticlePublic,
  ArticlePublicBody,
  ArticleSnapshot,
  ArticleWorkingCopy
}

url = System.fetch_env!("R8_CONNECTION_FILE") |> File.read!() |> String.trim()
uri = URI.parse(url)

unless Mix.env() == :test and
         uri.host == "ep-aged-poetry-a14z054n.ap-southeast-1.aws.neon.tech" and
         uri.path == "/groupher_mentions_graph_20261106" do
  raise "R8 integration probe requires the named disposable clone"
end

config =
  Application.fetch_env!(:groupher_server, Repo)
  |> Keyword.drop([:username, :password, :database, :hostname, :port, :pool])
  |> Keyword.merge(
    url: url,
    pool: DBConnection.ConnectionPool,
    pool_size: 2,
    connect_timeout: 30_000,
    queue_target: 30_000,
    pool_timeout: 60_000,
    # Only this cross-region rehearsal allows long aggregate transactions.
    # Production command budgets are unchanged.
    timeout: 600_000,
    ssl: [
      verify: :verify_peer,
      cacerts: :public_key.cacerts_get(),
      server_name_indication: String.to_charlist(uri.host),
      customize_hostname_check: [match_fun: :public_key.pkix_verify_hostname_match_fun(:https)]
    ]
  )

Application.put_env(:groupher_server, Repo, config)
{:ok, _} = Application.ensure_all_started(:groupher_server)

{site, doc, _attrs, user} = mock_article(:doc)
actor = %{user | cur_passport: %{"global" => %{"god" => true}}}
first = Repo.get!(ArticlePublic, doc.article_id)
snapshot = Repo.get!(ArticleSnapshot, first.snapshot_id)
assert Repo.get!(ArticleBody, snapshot.body_id).type == :snapshot
assert Repo.get!(ArticlePublicBody, doc.article_id)
refute Repo.exists?(from(w in ArticleWorkingCopy, where: w.article_id == ^doc.article_id))

assert {:ok, edit} =
         CMS.DocTree.Commands.BeginEdit.execute(
           site,
           doc.article_id,
           first.snapshot_id,
           actor,
           Ecto.UUID.generate()
         )

assert Repo.get!(ArticleWorkingCopy, edit.working_copy_id)

assert {:ok, _} =
         CMS.Seeds.Docs.update(
           site,
           doc.article_id,
           %{title: "R8 current-model publication"},
           actor,
           Ecto.UUID.generate()
         )

second = Repo.get!(ArticlePublic, doc.article_id)
refute first.snapshot_id == second.snapshot_id
assert Repo.get!(ArticleSnapshot, first.snapshot_id)
refute Repo.exists?(from(w in ArticleWorkingCopy, where: w.article_id == ^doc.article_id))

assert {:ok, %{done: true}} = CMS.Seeds.Docs.delete(site, doc.article_id, actor)
refute Repo.get(ArticlePublic, doc.article_id)
refute Repo.get(ArticlePublicBody, doc.article_id)
assert Repo.get!(Article, doc.article_id)
assert Repo.get!(ArticleSnapshot, first.snapshot_id)
assert Repo.get!(ArticleSnapshot, second.snapshot_id)
assert Repo.get!(ArticleBody, snapshot.body_id)

File.write!(
  System.fetch_env!("R8_EVIDENCE_FILE"),
  Jason.encode!(
    %{
      host: uri.host,
      database: String.trim_leading(uri.path, "/"),
      result: "passed",
      checks: [
        "public body independent projection",
        "initial D consumed",
        "edit recreates D",
        "republish consumes clean D",
        "old Snapshot retained",
        "single Doc purge retains history and removes Public"
      ]
    },
    pretty: true
  )
)

IO.puts("R8 clone publication, body storage, D lifecycle and history retention passed")
