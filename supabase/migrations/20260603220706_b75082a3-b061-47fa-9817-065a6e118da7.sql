UPDATE auth.users
SET encrypted_password = crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf')),
    updated_at = now()
WHERE email IN ('agent@claimlens.demo', 'adjuster@claimlens.demo', 'admin@claimlens.demo');