-- Add seat_preference and meal_preference to party_person for Person clients
-- seat_preference: window | aisle | null (no preference)
-- meal_preference: standard | vegan | vegetarian | halal | kosher | gluten_free | lactose_free | diabetic | child | other | null

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party_person'
        AND column_name = 'seat_preference'
    ) THEN
        ALTER TABLE public.party_person
        ADD COLUMN seat_preference text;

        COMMENT ON COLUMN public.party_person.seat_preference IS 'Seat preference: window, aisle, or null (no preference)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party_person'
        AND column_name = 'meal_preference'
    ) THEN
        ALTER TABLE public.party_person
        ADD COLUMN meal_preference text;

        COMMENT ON COLUMN public.party_person.meal_preference IS 'Dietary/meal preference: standard, vegan, vegetarian, halal, kosher, gluten_free, lactose_free, diabetic, child, other, or null';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'party_person'
        AND column_name = 'preferences_notes'
    ) THEN
        ALTER TABLE public.party_person
        ADD COLUMN preferences_notes text;

        COMMENT ON COLUMN public.party_person.preferences_notes IS 'Free-text notes for preferences (e.g. special requests, allergies)';
    END IF;
END $$;
