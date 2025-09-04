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

ActiveRecord::Schema[7.0].define(version: 2025_07_28_110001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "bank_accounts", force: :cascade do |t|
    t.string "subject_type"
    t.bigint "subject_id"
    t.bigint "organization_id", null: false
    t.string "iban"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["organization_id"], name: "index_bank_accounts_on_organization_id"
    t.index ["subject_type", "subject_id"], name: "index_bank_accounts_on_subject"
  end

  create_table "cs_organizations", force: :cascade do |t|
    t.integer "organization_id", null: false
    t.boolean "vip", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["organization_id"], name: "index_cs_organizations_on_organization_id", unique: true
  end

  create_table "incomes", force: :cascade do |t|
    t.bigint "bank_account_id", null: false
    t.integer "amount"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bank_account_id"], name: "index_incomes_on_bank_account_id"
  end

  create_table "organizations", force: :cascade do |t|
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "transactions", force: :cascade do |t|
    t.bigint "bank_account_id", null: false
    t.string "subject_type", null: false
    t.bigint "subject_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bank_account_id"], name: "index_transactions_on_bank_account_id"
    t.index ["subject_type", "subject_id"], name: "index_transactions_on_subject"
  end

  add_foreign_key "bank_accounts", "organizations"
  add_foreign_key "incomes", "bank_accounts"
  add_foreign_key "transactions", "bank_accounts"
end
