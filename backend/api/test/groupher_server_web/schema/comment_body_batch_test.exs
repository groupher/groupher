defmodule GroupherServerWeb.CommentBodyBatchTest.Schema do
  use Absinthe.Schema

  alias GroupherServerWeb.Schema.Helper.Fields

  def plugins, do: [Absinthe.Middleware.Dataloader | Absinthe.Plugin.defaults()]
  def context(ctx), do: Map.put(ctx, :loader, GroupherServerWeb.Schema.dataloader())

  object :body do
    field(:version, :integer)
  end

  object :comment do
    field(:body, :body, resolve: &Fields.comment_body/3)
    field(:body_version, :integer, resolve: &Fields.comment_body_version/3)
  end

  query do
    field :comments, list_of(:comment) do
      resolve(fn _, _, %{context: %{comments: comments}} -> {:ok, comments} end)
    end
  end
end

defmodule GroupherServerWeb.CommentBodyBatchTest do
  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.Comment

  test "loads both fields for unloaded comments and map projections with one body query" do
    {community, post, _attrs, author} = mock_article(:post, preload: [author: :user])

    comments =
      Enum.map(1..3, fn n ->
        {:ok, comment} =
          CMS.Comments.create_comment(
            community,
            :post,
            article_inner_id(post, community),
            mock_comment("comment #{n}"),
            author,
            Ecto.UUID.generate()
          )

        if n == 3, do: %{id: comment.id}, else: Repo.get!(Comment, comment.id)
      end)

    owner = self()
    ref = make_ref()
    handler = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler,
        event,
        fn _, _, metadata, _ ->
          if String.contains?(metadata.query, "comment_bodies") do
            send(owner, {ref, metadata.query})
          end
        end,
        nil
      )

    try do
      assert {:ok, %{data: %{"comments" => rows}}} =
               Absinthe.run("{ comments { body { version } bodyVersion } }", __MODULE__.Schema,
                 context: %{comments: comments}
               )

      assert Enum.map(rows, & &1["bodyVersion"]) == [1, 1, 1]
      assert Enum.all?(rows, &(&1["body"]["version"] == 1))
      assert_receive {^ref, _query}
      refute_receive {^ref, _query}, 50
    after
      :telemetry.detach(handler)
    end
  end
end
