import fetch from 'node-fetch';

async function test() {
  const uniqueId = Date.now();
  const email = `unique_${uniqueId}@test.com`;
  const name = `Test User ${uniqueId}`;
  
  const user = { RealName: name, Email: email };
  const password = "password123";

  // First registration
  const res1 = await fetch('http://localhost:3000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, password })
  });
  console.log("Response 1:", res1.status, await res1.json());
  
  if (res1.status !== 200) {
      console.log("Failed first registration");
      return;
  }

  // Second registration (same email)
  const res2 = await fetch('http://localhost:3000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, password })
  });
  console.log("Response 2:", res2.status, await res2.json());
  
  if (res2.status === 400) {
      console.log("Successfully blocked duplicate registration!");
  } else {
      console.log("Failed to block duplicate registration");
  }
}

test();
