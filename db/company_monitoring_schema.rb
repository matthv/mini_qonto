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

ActiveRecord::Schema[7.0].define(version: 2025_09_02_100001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "companies_views", force: :cascade do |t|
    t.bigint "organization_id"
    t.string "country_code"
    t.string "siren"
    t.string "creditsafe_safenumber"
    t.string "organization_status"
    t.datetime "created_at"
    t.string "algorithm_check_status"
    t.string "algorithm_check_desc"
    t.datetime "algorithm_check_date"
    t.datetime "algorithm_check_created_at"
    t.string "collective_procedure_status"
    t.datetime "collective_procedure_created_at"
  end

end
