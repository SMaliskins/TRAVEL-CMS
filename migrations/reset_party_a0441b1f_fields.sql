-- Reset all fields for party a0441b1f-5d4d-4168-8213-dcd85dfbd7c8
-- KEEPS: first_name, last_name
-- CLEARS: all other person/party fields
-- Run in Supabase SQL Editor with service_role

DO $$
DECLARE
  target_party_id uuid := 'a0441b1f-5d4d-4168-8213-dcd85dfbd7c8';
BEGIN
  -- 1. party_person: clear all except first_name, last_name
  UPDATE public.party_person
  SET
    title = NULL,
    gender = NULL,
    dob = NULL,
    personal_code = NULL,
    citizenship = NULL,
    address = NULL,
    passport_number = NULL,
    passport_issue_date = NULL,
    passport_expiry_date = NULL,
    passport_issuing_country = NULL,
    passport_full_name = NULL,
    nationality = NULL,
    avatar_url = NULL,
    is_alien_passport = false,
    seat_preference = NULL,
    meal_preference = NULL,
    preferences_notes = NULL,
    correspondence_languages = NULL,
    invoice_language = NULL
  WHERE party_id = target_party_id;

  -- 2. party: clear common fields (email, phone, country, bank_accounts, loyalty_cards, corporate_accounts)
  UPDATE public.party
  SET
    email = NULL,
    phone = NULL,
    country = NULL,
    bank_accounts = NULL,
    corporate_accounts = NULL,
    loyalty_cards = NULL,
    updated_at = now()
  WHERE id = target_party_id;

  -- 3. Update display_name from first_name + last_name
  UPDATE public.party p
  SET display_name = (
    SELECT TRIM(first_name || ' ' || COALESCE(last_name, ''))
    FROM public.party_person pp
    WHERE pp.party_id = p.id
    LIMIT 1
  )
  WHERE p.id = target_party_id;

  RAISE NOTICE 'Reset complete for party %', target_party_id;
END $$;
