import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://gwgnajyfwhdgpbhrtpal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z25hanlmd2hkZ3BiaHJ0cGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjczMjEsImV4cCI6MjA4OTc0MzMyMX0.auBGCcEnuBEXUjdyfUGi-4h56TMt-CkT1th6zQYNrM4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 获取邮箱前缀作为用户名
export function getUsernameFromEmail(email) {
  return email.split('@')[0];
}

// 提交分数到排行榜
export async function submitScore(userId, username, score) {
  const { data, error } = await supabase
    .from('leaderboard')
    .insert([
      {
        user_id: userId,
        username: username,
        score: score
      }
    ]);

  if (error) throw error;
  return data;
}

// 获取前十排行榜
export async function getLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('username, score')
    .order('score', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data;
}
