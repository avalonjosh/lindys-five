const API_BASE = '/api/admin';

export async function login(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function verifySession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/verify`, {
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}
