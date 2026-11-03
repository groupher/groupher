defmodule GroupherServer.CMS.Model.ArtimentMention do
  @moduledoc """
  Persists one stable, Community-independent directed Mention fact.

      parsed occurrence -> typed source/target IDs -> public graph projection
  """

  use Ecto.Schema
  use Flop.Schema

  import Ecto.Changeset

  alias __MODULE__
  alias Helper.Constant.DBPrefix

  @flop_options [filterable: [], sortable: [:id, :inserted_at], pagination_types: [:page, :first]]
  @schema_prefix DBPrefix.cms()
  @mentioner_types [:post, :blog, :changelog, :doc, :ticket, :comment]
  @mentioned_types @mentioner_types ++ [:user, :url]

  @type t :: %ArtimentMention{}

  schema "artiment_mentions" do
    field(:mentioner_type, Ecto.Enum, values: @mentioner_types)
    field(:mentioner_article_id, Ecto.UUID)
    field(:mentioner_comment_id, :id)
    field(:mentioner_branch_id, :id)

    field(:mentioned_scope, Ecto.Enum, values: [:internal, :external])
    field(:mentioned_type, Ecto.Enum, values: @mentioned_types)
    field(:mentioned_article_id, Ecto.UUID)
    field(:mentioned_comment_id, :id)
    field(:mentioned_user_id, :id)
    field(:mentioned_branch_id, :id)
    field(:external_url, :string)
    field(:external_url_hash, :string)

    field(:mention_case, Ecto.Enum, values: [:inline_mention, :link])
    field(:occurrences, ArtimentMention.Occurrences)
    field(:edge_key, :string)
    field(:mentioned_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @fields ~w(
    mentioner_type mentioner_article_id mentioner_comment_id mentioner_branch_id
    mentioned_scope mentioned_type mentioned_article_id mentioned_comment_id
    mentioned_user_id mentioned_branch_id external_url external_url_hash
    mention_case occurrences mentioned_at
  )a

  def changeset(%ArtimentMention{} = mention, attrs) do
    mention
    |> cast(attrs, @fields)
    |> validate_required([
      :mentioner_type,
      :mentioned_scope,
      :mentioned_type,
      :mention_case,
      :occurrences,
      :mentioned_at
    ])
    |> validate_source_identity()
    |> validate_target_identity()
    |> validate_case()
    |> validate_occurrences()
    |> unique_constraint(:edge_key)
    |> check_constraint(:mentioner_article_id, name: :mention_source_identity_check)
    |> check_constraint(:mentioned_article_id, name: :mention_target_identity_check)
    |> check_constraint(:occurrences, name: :mention_occurrences_check)
  end

  defp validate_source_identity(changeset) do
    source_type = get_field(changeset, :mentioner_type)
    source_article = get_field(changeset, :mentioner_article_id)
    source_comment = get_field(changeset, :mentioner_comment_id)

    case {source_type, source_article, source_comment} do
      {:comment, nil, id} when not is_nil(id) ->
        changeset

      {:doc, id, nil} when not is_nil(id) ->
        validate_required(changeset, [:mentioner_branch_id])

      {type, id, nil} when type in [:post, :blog, :changelog, :ticket] and not is_nil(id) ->
        reject_present(changeset, :mentioner_branch_id)

      _ ->
        add_error(changeset, :mentioner_type, "does not match source identity")
    end
  end

  defp validate_target_identity(changeset) do
    scope = get_field(changeset, :mentioned_scope)
    type = get_field(changeset, :mentioned_type)
    article_id = get_field(changeset, :mentioned_article_id)
    comment_id = get_field(changeset, :mentioned_comment_id)
    user_id = get_field(changeset, :mentioned_user_id)
    branch_id = get_field(changeset, :mentioned_branch_id)
    url = get_field(changeset, :external_url)
    hash = get_field(changeset, :external_url_hash)

    case {scope, type} do
      {:external, :url} ->
        changeset
        |> validate_required([:external_url, :external_url_hash])
        |> reject_present(:mentioned_article_id)
        |> reject_present(:mentioned_comment_id)
        |> reject_present(:mentioned_user_id)
        |> reject_present(:mentioned_branch_id)

      {:internal, type} when type in [:post, :blog, :changelog, :doc, :ticket] ->
        changeset
        |> validate_required([:mentioned_article_id])
        |> reject_present(:mentioned_comment_id)
        |> reject_present(:mentioned_user_id)
        |> reject_present(:external_url)
        |> reject_present(:external_url_hash)
        |> validate_branch(type, branch_id)

      {:internal, :comment} ->
        changeset
        |> validate_required([:mentioned_comment_id])
        |> reject_present(:mentioned_article_id)
        |> reject_present(:mentioned_user_id)
        |> reject_present(:external_url)
        |> reject_present(:external_url_hash)

      {:internal, :user} ->
        changeset
        |> validate_required([:mentioned_user_id])
        |> reject_present(:mentioned_article_id)
        |> reject_present(:mentioned_comment_id)
        |> reject_present(:mentioned_branch_id)
        |> reject_present(:external_url)
        |> reject_present(:external_url_hash)

      _ ->
        if is_nil(scope) or is_nil(type) or
             Enum.any?([article_id, comment_id, user_id, url, hash], &(not is_nil(&1))) do
          add_error(changeset, :mentioned_type, "does not match target identity")
        else
          changeset
        end
    end
  end

  defp validate_branch(changeset, :doc, _branch),
    do: validate_required(changeset, [:mentioned_branch_id])

  defp validate_branch(changeset, _type, _branch),
    do: reject_present(changeset, :mentioned_branch_id)

  defp validate_case(changeset) do
    case {get_field(changeset, :mentioned_scope), get_field(changeset, :mention_case)} do
      {:internal, :link} -> add_error(changeset, :mention_case, "must be inline_mention")
      {:external, :inline_mention} -> add_error(changeset, :mention_case, "must be link")
      _ -> changeset
    end
  end

  defp validate_occurrences(changeset) do
    case get_field(changeset, :occurrences) do
      [_ | _] -> changeset
      _ -> add_error(changeset, :occurrences, "must contain at least one position")
    end
  end

  defp reject_present(changeset, field) do
    if is_nil(get_field(changeset, field)),
      do: changeset,
      else: add_error(changeset, field, "must be blank")
  end
end
