defmodule GroupherServer.CMS.Comments.Participants do
  @moduledoc """
  Maintains article comment participant projections.
  """

  import Helper.Utils, only: [strip_struct: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.{Comment, Embeds}
  alias Helper.{ORM, T}

  @max_participator_count Comment.max_participator_count()

  @spec add_to_article(map(), User.t()) :: T.domain_res(term())
  def add_to_article(
        %{comments_participants: _participants} = article,
        %User{} = user
      ) do
    with {:ok, locked_article} <- ORM.lock_article(article) do
      normalized_participants =
        locked_article.comments_participants
        |> Enum.map(&Embeds.User.normalize/1)
        |> Enum.filter(&Embeds.User.valid?/1)

      cur_participants =
        normalized_participants
        |> List.insert_at(0, Embeds.User.from_account_user(user))
        |> Enum.filter(&Embeds.User.valid?/1)
        |> Enum.uniq_by(&Embeds.User.uniq_key/1)

      meta = locked_article.meta |> strip_struct

      cur_participants_ids =
        (meta.comments_participant_user_ids ++ [user.id])
        |> Enum.reject(&is_nil/1)
        |> Enum.uniq()

      meta = Map.merge(meta, %{comments_participant_user_ids: cur_participants_ids})

      latest_participants = cur_participants |> Enum.slice(0, @max_participator_count)

      locked_article = %{locked_article | comments_participants: normalized_participants}

      with {:ok, article} <-
             locked_article
             |> Ecto.Changeset.change()
             |> Ecto.Changeset.put_change(
               :comments_participants_count,
               length(cur_participants_ids)
             )
             |> Ecto.Changeset.put_embed(:comments_participants, latest_participants)
             |> Repo.update() do
        ORM.update_meta(article, meta)
      end
    end
  end

  def add_to_article(_, _), do: {:ok, :pass}
end
