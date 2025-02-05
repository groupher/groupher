defmodule GroupherServer.Mock.CMS.Kanban do
  import Ecto.Query, warn: false

  alias GroupherServer.CMS.Model.{Community, Post}

  alias Helper.ORM

  # {:ok, community} = ORM.find_by(Community, %{slug: "home"})
  # IO.inspect community

  def find_community do
    # {:ok, community} = ORM.find_by(Community, %{slug: "home"})
  end

  # post_attrs = mock_attrs(:post, %{community_id: community.id})

  # {:ok, kanban} = CMS.create_article(community, :post, post_attrs, user)
  # {:ok, post} = CMS.set_post_state(kanban, @article_state.todo)

  # def random_attrs do
  #   %{
  #     title: Faker.Name.first_name() <> " " <> Faker.Name.last_name(),
  #     body: Faker.Lorem.sentence(20)
  #   }
  # end

  # def random(count \\ 1) do
  #   for _u <- 1..count do
  #     insert_multi()
  #   end
  # end
end



GroupherServer.Mock.CMS.Kanban.find_community()
