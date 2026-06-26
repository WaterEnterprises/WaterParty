
import fetch from 'node-fetch';

async function test() {
  const email = "duplicate@test.com";
  const user = { RealName: "Test User", Email: email };
  const password = "password123";

  // First registration
  const res1 = await fetch('http://localhost:3000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, password })
  });
  console.log("Reponse 1:", res1.status, await res1.json());
  
  if (res1.status !== 200) {
      console.log("Failed first registration");
      return;
  }

  // Second registration
  const res2 = await fetch('http://localhost:3000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, password })
  });
  console.log("Reponse 2:", res2.status, await res2.json());
}

test();
