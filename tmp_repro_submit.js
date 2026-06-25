const base = 'http://localhost:3000';

(async () => {
  try {
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'an.binh@student.thpt.edu.vn', password: 'student@123' }),
    });

    const loginData = await login.json();
    console.error('LOGIN', login.status, loginData);

    const res = await fetch(`${base}/api/submissions/862ae59e-35b6-4f81-95db-b1390bd595b5/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.accessToken}`,
      },
      body: JSON.stringify({}),
    });

    const body = await res.text();
    console.error('SUBMIT', res.status, body);
  } catch (err) {
    console.error('ERROR', err);
  }
})();
