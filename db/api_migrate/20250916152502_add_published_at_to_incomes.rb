class AddPublishedAtToIncomes < ActiveRecord::Migration[7.0]
  def change
    add_column :incomes, :published_at, :datetime, with_timezone: true
  end
end
