# Local-only real API fixture for the Doc Comment / MentionsGraph browser acceptance.
# A dedicated test database is required; this never connects to a target deployment.
import Ecto.Query
import GroupherServer.Support.Factory
alias GroupherServer.{CMS, Repo}
alias CMS.ArtimentMentions.Model.{Endpoint, CurrentSet}
alias CMS.Outbox.Event

unless Mix.env() == :test and
         String.starts_with?(System.get_env("TEST_DB_NAME", ""), "groupher_mentions_joint_") do
  raise "Run only with MIX_ENV=test and a dedicated groupher_mentions_joint_* TEST_DB_NAME"
end

endpoint = GroupherServerWeb.Endpoint
config = Application.fetch_env!(:groupher_server, endpoint)
port = String.to_integer(System.get_env("CMS_MENTIONS_BROWSER_PORT", "4197"))

Application.put_env(
  :groupher_server,
  endpoint,
  Keyword.merge(config, http: [ip: {127, 0, 0, 1}, port: port], server: true)
)

# Browser requests use normal short-lived checkouts in this owned fixture database.
Application.put_env(
  :groupher_server,
  Repo,
  Application.fetch_env!(:groupher_server, Repo)
  |> Keyword.put(:pool, DBConnection.ConnectionPool)
)

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:groupher_server)

unless Repo.config()[:database] == System.fetch_env!("TEST_DB_NAME") do
  raise "Actual database differs from the explicit fixture database"
end

if Repo.aggregate(CMS.Model.Article, :count) != 0 or
     Repo.aggregate(CMS.Model.Community, :count) != 0 do
  raise "Fixture database must be empty; do not delete or reuse other data"
end

{:ok, user} = db_insert(:user, login: "xx", nickname: "Joint acceptance author")

{:ok, community} =
  mock_community(user, %{slug: "home", title: "MentionsGraph joint acceptance", locale: "en"})

{_, doc, _, _} = mock_article(:doc, community, user)
{_, target, _, _} = mock_article(:blog, community, user)
{_, post, _, _} = mock_article(:post, community, user)
{:ok, recipient} = db_insert(:user)

body =
  mock_body_bag(
    Jason.encode!([
      %{
        "type" => "p",
        "id" => "joint-browser",
        "children" => [
          %{"text" => "Joint browser reference "},
          %{
            "type" => "mention",
            "key" => "blog:#{target.article_id}",
            "value" => "Joint target",
            "children" => [%{"text" => ""}]
          },
          %{
            "type" => "mention",
            "key" => "user:#{recipient.login}",
            "value" => "Recipient",
            "children" => [%{"text" => ""}]
          }
        ]
      }
    ])
  )

{:ok, doc_comment} =
  CMS.Comments.create_comment(community, :doc, doc.inner_id, body, user, Ecto.UUID.generate())

{:ok, post_comment} =
  CMS.Comments.create_comment(community, :post, post.inner_id, body, user, Ecto.UUID.generate())

{:ok, reply} =
  CMS.Comments.reply_comment(
    Map.put(post_comment, :request_community_slug, community.slug),
    body,
    user,
    Ecto.UUID.generate()
  )

for event <-
      Repo.all(
        from(e in Event,
          where: e.event == "mention.notify",
          order_by: [asc: e.inserted_at, asc: e.id]
        )
      ) do
  {:ok, :pass} =
    GroupherServer.Jobs.CMSMentionNotifier.perform(%Oban.Job{
      args: %{"event_id" => event.id},
      attempt: 1,
      max_attempts: 5
    })
end

comment_endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: doc_comment.id)
state = Repo.get!(CurrentSet, comment_endpoint.id)
true = not is_nil(state.set_id)

doc_public =
  Repo.get_by!(CMS.Model.DocPublic, article_id: doc.article_id, branch_id: doc.branch_id)

fixture = %{
  database: Repo.config()[:database],
  community: community.slug,
  doc_inner_id: doc.inner_id,
  doc_comment_inner_id: doc_comment.inner_id,
  post_inner_id: post.inner_id,
  post_comment_inner_id: post_comment.inner_id,
  reply_inner_id: reply.inner_id,
  doc_path: "/#{community.slug}/doc/#{doc.inner_id}/#{doc_public.slug}",
  post_path: "/#{community.slug}/post/#{post.inner_id}"
}

path = System.get_env("CMS_MENTIONS_BROWSER_FIXTURE", "/tmp/mentions-joint-browser-fixture.json")
File.write!(path, Jason.encode!(fixture, pretty: true))
IO.puts("Joint Doc Comment API ready on #{port}; fixture metadata: #{path}")
Process.sleep(:infinity)
