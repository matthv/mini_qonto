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

ActiveRecord::Schema[7.0].define(version: 2025_08_20_150002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "claims", force: :cascade do |t|
    t.integer "organization_id", null: false
    t.string "type"
    t.string "status"
    t.date "claimed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["organization_id"], name: "index_claims_on_organization_id"
  end

  create_table "disputed_transactions", force: :cascade do |t|
    t.bigint "claim_id", null: false
    t.integer "api_transaction_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["api_transaction_id"], name: "index_disputed_transactions_on_api_transaction_id"
    t.index ["claim_id"], name: "index_disputed_transactions_on_claim_id"
  end

  create_table "mastercom_claims", force: :cascade do |t|
    t.bigint "disputed_transaction_id", null: false
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["disputed_transaction_id"], name: "index_mastercom_claims_on_disputed_transaction_id"
  end

  add_foreign_key "disputed_transactions", "claims"
  add_foreign_key "mastercom_claims", "disputed_transactions"
end
