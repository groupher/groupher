defmodule GroupherServer.TestMate do
  @moduledoc """
  Shared ExUnit case template for endpoint and persistence tests.

  It layers project factories, connection simulators, common aliases, and stable
  date fixtures on top of `GroupherServerWeb.ConnCase`.

  Business position:

      Test case
        -> TestMate
        -> endpoint / fixture / Repo
  """
  use ExUnit.CaseTemplate

  using opts do
    conn_case_opts = [async: Keyword.get(opts, :async, true)]

    quote bind_quoted: [conn_case_opts: conn_case_opts] do
      use GroupherServerWeb.ConnCase, conn_case_opts

      import GroupherServer.Support.Factory
      import GroupherServer.Test.ConnSimulator
      import GroupherServer.Test.AssertHelper
      import Ecto.Query, warn: false
      import GroupherServer.ErrorCat

      import Helper.Utils,
        only: [camelize_map_key: 1, camelize_map_key: 2, get_config: 2]

      import ShortMaps

      alias GroupherServer.{Accounts, CMS, ErrorCat, FrontDesk, Repo}

      alias CMS.Model.{
        Author,
        Blog,
        Changelog,
        Comment,
        Community,
        Doc,
        Embeds,
        Article,
        Post
      }

      alias CMS.Model.ArticleBinding

      alias GroupherServer.Test
      alias Test.Helper.Schema, as: S
      alias Helper.{Constant, Datetime, ORM}

      alias Accounts.Model.User

      @now Datetime.now(:second)

      @last_week Datetime.shift(Datetime.beginning_of_week(@now), days: -1)
                 |> DateTime.truncate(:second)

      @last_month Datetime.beginning_of_month(Datetime.shift(@now, months: -1))
                  |> DateTime.truncate(:second)

      # NOTE: keep it strictly "old enough" across the whole year.
      # Using end_of_year(@now - 1y) makes it only a few weeks old in Jan,
      # which breaks time-threshold based tests (e.g. archive_threshold months: -3).
      @last_year Datetime.shift(@now, years: -1)
                 |> DateTime.truncate(:second)

      def article_inner_id(%{inner_id: inner_id}, _community), do: inner_id

      def article_inner_id(article, %Community{id: community_id}) when is_map(article) do
        article_id = Map.get(article, :article_id) || Map.get(article, :id)

        Repo.get_by!(ArticleBinding, article_id: article_id, community_id: community_id).inner_id
      end

      def article_bindings(article) when is_map(article) do
        {:ok, bindings} = GroupherServer.CMS.Articles.Bindings.all(article)
        bindings
      end

      def binding_communities(article) when is_map(article) do
        article |> article_bindings() |> Enum.map(& &1.community)
      end

      def binding_tags(article, %Community{} = community) when is_map(article) do
        {:ok, %{binding: binding}} = GroupherServer.CMS.Articles.Bindings.get(article, community)
        GroupherServer.CMS.Articles.Bindings.Tags.list(binding)
      end

      def article_path(%Community{slug: slug} = community, article, thread) do
        {:ok, %{inner_id: inner_id}} =
          GroupherServer.CMS.Articles.Bindings.get(%{article_id: article.id}, community)

        %{
          community: slug,
          inner_id: inner_id,
          thread: thread |> to_string() |> String.upcase()
        }
      end

      @doc "Reads an Article through the production ArticlePath-only FrontDesk contract."
      def read_article(article_path), do: FrontDesk.article(article_path)

      def read_article(article_path, actor) when is_map(article_path),
        do: FrontDesk.article(article_path, actor)

      def read_article(community, thread, inner_id),
        do: read_article(community, thread, inner_id, [])

      def read_article(%Community{slug: slug}, thread, inner_id, actor_or_opts),
        do: read_article(slug, thread, inner_id, actor_or_opts)

      def read_article(community, thread, inner_id, actor_or_opts) when is_binary(community) do
        article_path = %{community: community, thread: thread, inner_id: inner_id}

        actor = if is_list(actor_or_opts), do: nil, else: actor_or_opts
        FrontDesk.article(article_path, actor)
      end

      def comment_path(%Community{} = community, article, thread, %Comment{} = comment) do
        %{article: article_path(community, article, thread), inner_id: comment.inner_id}
      end

      def service_credential(id \\ "test-service") do
        %{
          audience: "phoenix:view-api",
          scopes: MapSet.new(["view:track"]),
          subject: "service:#{id}",
          token_id: id
        }
      end

      def track_article_view(article, viewer, opts \\ []) do
        request_actor_input =
          cond do
            Keyword.has_key?(opts, :delegation) ->
              [delegation: Keyword.fetch!(opts, :delegation)]

            Keyword.has_key?(opts, :service_credential) ->
              [service_credential: Keyword.fetch!(opts, :service_credential)]

            match?(%User{}, viewer) ->
              [account_session: viewer]

            Keyword.has_key?(opts, :anonymous_session) ->
              [anonymous_session: Keyword.fetch!(opts, :anonymous_session)]

            true ->
              []
          end

        {:ok, classification} = GroupherServer.RequestActor.classify(request_actor_input)
        CMS.ViewTracker.track(article, viewer, classification, opts)
      end

      @doc """
      Creates a community plus one explicit root Tab for Docs Tree tests.

      The fixture is inserted directly so it does not consume a Tree revision.
      `DocTreeNode.id` remains the physical row id, while `node_id` is the stable
      logical identity used by GraphQL and `parent_node_id`.
      """
      def create_empty_docs_community(user) do
        attrs = mock_attrs(:community) |> Map.put(:user, user)

        with {:ok, community} <- CMS.Communities.create(attrs, user),
             {:ok, state} <-
               ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id),
             {:ok, _tab} <-
               ORM.create(CMS.Model.DocTreeNode, %{
                 community_id: community.id,
                 branch_id: state.branch_id,
                 stage: :draft,
                 node_id: Ecto.UUID.generate(),
                 type: :tab,
                 title: "Introduction",
                 index: 0
               }) do
          {:ok, community}
        end
      end

      @doc """
      Returns the root Tab's logical `node_id`, never its physical row `id`.

      Child Tree rows store this value in `parent_node_id`.
      """
      def root_doc_tab_node_id(%Community{} = community) do
        CMS.Model.DocTreeNode
        |> where([node], node.community_id == ^community.id)
        |> where([node], node.stage == :draft and node.type == :tab)
        |> order_by([node], asc: node.index, asc: node.id)
        |> select([node], node.node_id)
        |> limit(1)
        |> Repo.one!()
      end
    end
  end
end
