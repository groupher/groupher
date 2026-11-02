defmodule GroupherServer.CMS.Articles.ArticleLite do
  @moduledoc """
  Stable public Article list projection and Flop schema owner.

  The projection keeps content, path, author, and bounded tag summaries in one
  query. Sort-only values stay private to the pagination adapter and the stats
  join is added only when the resolved `Pagi.Order` requires it.

      Article list query -> ArticleLite projection -> Pagi.Order joins -> page payload
  """

  use Ecto.Schema
  use Flop.Schema

  require Ecto.Query
  import Ecto.Query, except: [select: 3], warn: false

  alias GroupherServer.{CMS}

  alias CMS.Model.{
    ArticleBindingTag,
    ArticleStats,
    Author,
    CommunityTag,
    CommunityTagGroup,
    PostState
  }

  alias Helper.ORM.Pagi.Order

  @primary_key false

  @flop_options [
    filterable: [],
    sortable: [
      :active_at,
      :inserted_at,
      :published_at,
      :doc_active_at,
      :inner_id,
      :binding_id,
      :views,
      :upvotes_count,
      :comments_count
    ],
    pagination_types: [:page, :first],
    adapter_opts: [
      join_fields: [
        published_at: [binding: :stable_public, field: :published_at, ecto_type: :utc_datetime],
        doc_active_at: [binding: :stable_doc_state, field: :active_at, ecto_type: :utc_datetime],
        inner_id: [binding: :article_binding, field: :inner_id, ecto_type: :integer],
        binding_id: [binding: :article_binding, field: :id, ecto_type: :integer]
      ],
      custom_fields: [
        views: [
          field_dynamic: {__MODULE__, :stats_field, [field: :views]},
          ecto_type: :integer,
          bindings: [:article_stats]
        ],
        upvotes_count: [
          field_dynamic: {__MODULE__, :stats_field, [field: :upvotes_count]},
          ecto_type: :integer,
          bindings: [:article_stats]
        ],
        comments_count: [
          field_dynamic: {__MODULE__, :stats_field, [field: :comments_count]},
          ecto_type: :integer,
          bindings: [:article_stats]
        ]
      ]
    ]
  ]

  embedded_schema do
    field(:active_at, :utc_datetime)
    field(:inserted_at, :utc_datetime)
  end

  @doc "Adds the stable Lite projection and only the joins required by `order`."
  @spec select(Ecto.Queryable.t(), Order.t(), atom()) :: Ecto.Query.t()
  def select(query, %Order{} = order, thread) do
    query
    |> join_author()
    |> join_tags()
    |> maybe_join_stats(order)
    |> select_content(thread)
    |> select_post_category(thread)
    |> select_sort_projection(order)
  end

  @doc "Extracts every cursor field from the private projection, failing on omissions."
  @spec cursor_values(map(), [atom()]) :: map()
  def cursor_values(entry, fields) when is_map(entry) and is_list(fields) do
    Map.new(fields, fn field -> {field, Map.fetch!(entry, field)} end)
  end

  @doc false
  def stats_field(opts) do
    field_name = Keyword.fetch!(opts, :field)
    dynamic([article_stats: stats], fragment("COALESCE(?, 0)", field(stats, ^field_name)))
  end

  @doc "Converts the JSON tag aggregate into loaded CommunityTag schemas."
  @spec community_tags([map()] | nil, struct()) :: [CommunityTag.t()]
  def community_tags(nil, _community), do: []

  def community_tags(tags, community) when is_list(tags) do
    Enum.map(tags, fn tag ->
      %CommunityTag{
        id: value(tag, "id"),
        title: value(tag, "title"),
        desc: value(tag, "desc"),
        layout: value(tag, "layout"),
        slug: value(tag, "slug"),
        color: enum_value(CommunityTag, :color, value(tag, "color")),
        thread: enum_value(CommunityTag, :thread, value(tag, "thread")),
        group: value(tag, "group"),
        group_id: value(tag, "group_id"),
        extra: value(tag, "extra"),
        marker: value(tag, "marker"),
        index: value(tag, "index"),
        community_id: community.id,
        community: community
      }
    end)
  end

  defp select_post_category(query, :post) do
    query =
      if has_named_binding?(query, :post_state),
        do: query,
        else:
          join(query, :left, [article: article], state in PostState,
            as: :post_state,
            on: state.article_id == article.id
          )

    Ecto.Query.select_merge(query, [post_state: post], %{cat: post.cat})
  end

  defp select_post_category(query, _thread), do: query

  defp join_author(query) do
    query
    |> join(:inner, [article: article], author in Author,
      as: :article_author,
      on: author.id == article.author_id
    )
    |> join(:inner, [article_author: author], user in assoc(author, :user),
      as: :article_author_user
    )
  end

  defp join_tags(query) do
    tags =
      from(assignment in ArticleBindingTag,
        join: tag in CommunityTag,
        on: tag.id == assignment.tag_id,
        join: tag_group in CommunityTagGroup,
        on: tag_group.id == tag.group_id,
        where: assignment.article_binding_id == parent_as(:article_binding).id,
        select: %{
          community_tags:
            fragment(
              "COALESCE(jsonb_agg(jsonb_build_object('id', ?, 'title', ?, 'desc', ?, 'layout', ?, 'slug', ?, 'color', ?, 'thread', ?, 'group', ?, 'group_id', ?, 'extra', ?, 'marker', ?, 'index', ?) ORDER BY ?, ?), '[]'::jsonb)",
              tag.id,
              tag.title,
              tag.desc,
              tag.layout,
              tag.slug,
              tag.color,
              tag.thread,
              tag_group.title,
              tag.group_id,
              tag.extra,
              tag.marker,
              tag.index,
              tag.index,
              tag.id
            )
        }
      )

    join(query, :left_lateral, [], tag_rows in subquery(tags),
      as: :article_tag_rows,
      on: true
    )
  end

  defp maybe_join_stats(query, %Order{bindings: bindings}) do
    if :article_stats in bindings do
      join(query, :left, [article: article], stats in ArticleStats,
        as: :article_stats,
        on: stats.article_id == article.id and stats.thread == article.thread
      )
    else
      query
    end
  end

  defp select_content(query, :doc) do
    Ecto.Query.select(
      query,
      [
        article: article,
        article_binding: binding,
        article_community: community,
        article_author_user: user,
        article_tag_rows: tag_rows,
        stable_doc_state: state,
        stable_public: public
      ],
      %{
        article: article,
        community: community,
        author: user,
        community_tags: tag_rows.community_tags,
        inner_id: binding.inner_id,
        binding_id: binding.id,
        title: public.title,
        digest: public.digest,
        active_at: state.active_at,
        published_at: public.published_at,
        doc_active_at: state.active_at,
        inserted_at: article.inserted_at
      }
    )
  end

  defp select_content(query, _thread) do
    Ecto.Query.select(
      query,
      [
        article: article,
        article_binding: binding,
        article_community: community,
        article_author_user: user,
        article_tag_rows: tag_rows,
        stable_public: public
      ],
      %{
        article: article,
        community: community,
        author: user,
        community_tags: tag_rows.community_tags,
        inner_id: binding.inner_id,
        binding_id: binding.id,
        title: public.title,
        digest: public.digest,
        active_at: article.active_at,
        published_at: public.published_at,
        doc_active_at: nil,
        inserted_at: article.inserted_at
      }
    )
  end

  defp select_sort_projection(query, %Order{projection: projection}) do
    Enum.reduce(projection, query, fn
      :views, query ->
        select_merge(query, [article_stats: stats], %{views: coalesce(stats.views, 0)})

      :upvotes_count, query ->
        select_merge(query, [article_stats: stats], %{
          upvotes_count: coalesce(stats.upvotes_count, 0)
        })

      :comments_count, query ->
        select_merge(query, [article_stats: stats], %{
          comments_count: coalesce(stats.comments_count, 0)
        })

      _field, query ->
        query
    end)
  end

  defp value(map, key), do: Map.get(map, key, Map.get(map, String.to_atom(key)))

  defp enum_value(_schema, _field, nil), do: nil

  defp enum_value(schema, field, value) do
    case Ecto.Enum.cast_value(schema, field, value) do
      {:ok, enum} -> enum
      :error -> nil
    end
  end
end
