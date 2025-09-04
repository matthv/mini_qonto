# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.0].define(version: 2025_09_02_110002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "products", force: :cascade do |t|
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "subscriptions", force: :cascade do |t|
    t.bigint "product_id", null: false
    t.string "status"
    t.string "recurrence"
    t.datetime "activated_at"
    t.datetime "ended_at"
    t.date "renewal_date"
    t.date "trial_end_date"
    t.bigint "promotion_activation_id"
    t.integer "target_product_ids", default: [], array: true
    t.bigint "trial_from_product_id"
    t.string "trial_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id"], name: "index_subscriptions_on_product_id"
    t.index ["trial_from_product_id"], name: "index_subscriptions_on_trial_from_product_id"
  end

  add_foreign_key "subscriptions", "products"
  add_foreign_key "subscriptions", "products", column: "trial_from_product_id"
end
