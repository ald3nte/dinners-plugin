import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gthhgqycvbyckewqwuyz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aGhncXljdmJ5Y2tld3F3dXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MDcwMTgsImV4cCI6MjA3NDk4MzAxOH0.-8s7gjgx0ueQN00zhA5nfqdvZbqGTGgL8S79M7W0dGA";

export const supabase = createClient(supabaseUrl, supabaseKey);