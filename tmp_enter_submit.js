const base = 'http://localhost:3000';

(async () => {
  try {
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'an.binh@student.thpt.edu.vn', password: 'student@123' }),
    });
    const loginData = await login.json();
    console.error('LOGIN', login.status, JSON.stringify(loginData));

    const enterRes = await fetch(`${base}/api/submissions/enter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.accessToken}`,
      },
      body: JSON.stringify({ schedule_id: 'bd954fa6-6425-40ab-9c22-fa5c908f0d9c' }),
    });
    const enterBody = await enterRes.text();
    console.error('ENTER', enterRes.status, enterBody);

    const submitRes = await fetch(`${base}/api/submissions/4526832a-64e9-4451-b371-baf5fb66fdd3/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.accessToken}`,
      },
      body: JSON.stringify({}),
    });
    const submitBody = await submitRes.text();
    console.error('SUBMIT EXIST', submitRes.status, submitBody);
  } catch (err) {
    console.error('ERROR', err);
  }
})();
