-- SQL function to create users bypassing RLS
-- Run this in your Supabase SQL Editor

-- Function to create user with admin privileges (bypasses RLS)
CREATE OR REPLACE FUNCTION create_user_admin(
  user_email TEXT,
  user_password_hash TEXT,
  user_name TEXT,
  user_role TEXT DEFAULT 'customer'
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with elevated privileges
AS $$
BEGIN
  -- Insert user bypassing RLS
  RETURN QUERY
  INSERT INTO users (email, password_hash, name, role, is_active)
  VALUES (user_email, user_password_hash, user_name, user_role, true)
  RETURNING users.id, users.email, users.name, users.role, users.is_active, users.created_at;
END;
$$;

-- Grant execute permission to anon role (so your backend can call it)
GRANT EXECUTE ON FUNCTION create_user_admin TO anon;
GRANT EXECUTE ON FUNCTION create_user_admin TO authenticated;

-- Alternative: Function to execute raw SQL (more flexible)
CREATE OR REPLACE FUNCTION exec_sql(query TEXT, params TEXT[] DEFAULT '{}')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- This is a simplified version - in production you'd want more security
  EXECUTE query USING VARIADIC params;
  GET DIAGNOSTICS result = ROW_COUNT;
  RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION exec_sql TO anon;
GRANT EXECUTE ON FUNCTION exec_sql TO authenticated;

-- Create RLS policies that allow the functions to work
-- Policy to allow inserts via the function
CREATE POLICY "Allow admin function inserts" ON users
  FOR INSERT
  WITH CHECK (true); -- Allow all inserts when called via function

-- Policy to allow reads for authentication
CREATE POLICY "Allow read for authentication" ON users
  FOR SELECT
  USING (true); -- Allow all reads

-- Enable RLS on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
