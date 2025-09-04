class CreateSubscriptions < ActiveRecord::Migration[7.0]
  def change
    create_table :subscriptions, id: false do |t|
      t.primary_key :id
      t.references :product, null: false, foreign_key: { to_table: :products }

      t.string   :status
      t.string   :recurrence
      t.datetime :activated_at
      t.datetime :ended_at
      t.date     :renewal_date
      t.date     :trial_end_date
      t.bigint   :promotion_activation_id
      t.integer  :target_product_ids, array: true, default: []
      t.references :trial_from_product, foreign_key: { to_table: :products }
      t.string   :trial_type

      t.timestamps
    end
  end
end
