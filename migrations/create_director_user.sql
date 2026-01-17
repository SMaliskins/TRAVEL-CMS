-- Create Director User: vera.laskova@gtr.lv
-- Date: 2026-01-17
-- Purpose: Add new user with director role

DO $$
DECLARE
    v_user_id uuid;
    v_company_id uuid;
BEGIN
    -- 1. Get company_id (assuming first company or specific company)
    SELECT id INTO v_company_id 
    FROM public.companies 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'No company found. Create company first.';
    END IF;
    
    RAISE NOTICE 'Using company_id: %', v_company_id;
    
    -- 2. Check if CHECK constraint allows 'director' role
    -- If not, we need to alter it first
    BEGIN
        -- Try to update profiles table constraint to include 'director'
        ALTER TABLE public.profiles 
        DROP CONSTRAINT IF EXISTS profiles_role_check;
        
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('agent', 'supervisor', 'director', 'admin'));
        
        RAISE NOTICE 'Updated profiles role constraint to include director and admin';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not update constraint (may not exist): %', SQLERRM;
    END;
    
    -- 3. Create user in auth.users (Supabase Auth)
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'vera.laskova@gtr.lv',
        crypt('Gull26rix!', gen_salt('bf')),  -- Password hashed with bcrypt
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    )
    ON CONFLICT (email) DO UPDATE
    SET 
        encrypted_password = crypt('Gull26rix!', gen_salt('bf')),
        updated_at = now()
    RETURNING id INTO v_user_id;
    
    RAISE NOTICE 'Created/Updated user: % (ID: %)', 'vera.laskova@gtr.lv', v_user_id;
    
    -- 4. Create profile with director role
    INSERT INTO public.profiles (
        user_id,
        company_id,
        role,
        display_name,
        created_at
    ) VALUES (
        v_user_id,
        v_company_id,
        'director',
        'Vera Laskova',
        now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        role = 'director',
        display_name = 'Vera Laskova',
        company_id = v_company_id;
    
    RAISE NOTICE 'Created/Updated profile with director role';
    
    -- 5. Verify
    RAISE NOTICE '=== User Created Successfully ===';
    RAISE NOTICE 'Email: vera.laskova@gtr.lv';
    RAISE NOTICE 'Password: Gull26rix!';
    RAISE NOTICE 'Role: director';
    RAISE NOTICE 'Company ID: %', v_company_id;
    RAISE NOTICE 'User ID: %', v_user_id;
    
END $$;

-- Verification query
SELECT 
    u.email,
    p.role,
    p.display_name,
    p.company_id,
    c.name as company_name
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
JOIN public.companies c ON p.company_id = c.id
WHERE u.email = 'vera.laskova@gtr.lv';
