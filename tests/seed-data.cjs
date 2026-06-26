/**
 * Seed Data Script
 * Registers 12 mock accounts with real-looking profile photos (via pravatar.cc)
 * and creates 2 parties each (24 total) with scenic photos (via picsum.photos).
 *
 * Usage: node seed-data.cjs
 */

const http = require('http');
const { WebSocket } = require('ws');

const BASE = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws';

// Proper profile photos via pravatar.cc (unique deterministic avatars)
const PROFILE_PHOTOS = [
  ['https://i.pravatar.cc/300?u=emma_waterparty'],
  ['https://i.pravatar.cc/300?u=james_waterparty'],
  ['https://i.pravatar.cc/300?u=sofia_waterparty'],
  ['https://i.pravatar.cc/300?u=marcus_waterparty'],
  ['https://i.pravatar.cc/300?u=olivia_waterparty'],
  ['https://i.pravatar.cc/300?u=liam_waterparty'],
  ['https://i.pravatar.cc/300?u=isabella_waterparty'],
  ['https://i.pravatar.cc/300?u=noah_waterparty'],
  ['https://i.pravatar.cc/300?u=ava_waterparty'],
  ['https://i.pravatar.cc/300?u=ethan_waterparty'],
  ['https://i.pravatar.cc/300?u=mia_waterparty'],
  ['https://i.pravatar.cc/300?u=lucas_waterparty'],
];

// Proper party photos via picsum.photos (random scenic photos)
const PARTY_PHOTOS_SETS = [
  ['https://picsum.photos/seed/rooftop-sunset/400/300', 'https://picsum.photos/seed/rooftop-view/400/300'],
  ['https://picsum.photos/seed/vinyl-wine/400/300', 'https://picsum.photos/seed/cozy-night/400/300'],
  ['https://picsum.photos/seed/boardgames/400/300', 'https://picsum.photos/seed/game-night/400/300'],
  ['https://picsum.photos/seed/indie-film/400/300', 'https://picsum.photos/seed/cinema/400/300'],
  ['https://picsum.photos/seed/art-fashion/400/300', 'https://picsum.photos/seed/art-gallery/400/300'],
  ['https://picsum.photos/seed/watercolor/400/300', 'https://picsum.photos/seed/paint-night/400/300'],
  ['https://picsum.photos/seed/dj-night/400/300', 'https://picsum.photos/seed/warehouse/400/300'],
  ['https://picsum.photos/seed/beat-battle/400/300', 'https://picsum.photos/seed/producer/400/300'],
  ['https://picsum.photos/seed/sunrise-yoga/400/300', 'https://picsum.photos/seed/brunch/400/300'],
  ['https://picsum.photos/seed/mindful/400/300', 'https://picsum.photos/seed/tea-time/400/300'],
  ['https://picsum.photos/seed/whiskey/400/300', 'https://picsum.photos/seed/architecture/400/300'],
  ['https://picsum.photos/seed/blueprint/400/300', 'https://picsum.photos/seed/rooftop-night/400/300'],
  ['https://picsum.photos/seed/photowalk/400/300', 'https://picsum.photos/seed/street-photo/400/300'],
  ['https://picsum.photos/seed/polaroid/400/300', 'https://picsum.photos/seed/photo-wall/400/300'],
  ['https://picsum.photos/seed/mixer/400/300', 'https://picsum.photos/seed/networking/400/300'],
  ['https://picsum.photos/seed/dinner-salon/400/300', 'https://picsum.photos/seed/intimate-dinner/400/300'],
  ['https://picsum.photos/seed/study-break/400/300', 'https://picsum.photos/seed/karaoke/400/300'],
  ['https://picsum.photos/seed/brunch-club/400/300', 'https://picsum.photos/seed/mimosas/400/300'],
  ['https://picsum.photos/seed/farm-table/400/300', 'https://picsum.photos/seed/fine-dining/400/300'],
  ['https://picsum.photos/seed/pasta-making/400/300', 'https://picsum.photos/seed/cooking-class/400/300'],
  ['https://picsum.photos/seed/design-happy/400/300', 'https://picsum.photos/seed/sketch/400/300'],
  ['https://picsum.photos/seed/scifi-night/400/300', 'https://picsum.photos/seed/movie-night/400/300'],
  ['https://picsum.photos/seed/poker-night/400/300', 'https://picsum.photos/seed/casino/400/300'],
  ['https://picsum.photos/seed/yacht-cruise/400/300', 'https://picsum.photos/seed/sunset-boat/400/300'],
];

// ── 12 Mock Users ──
const USERS = [
  { RealName: 'Emma Wilson',    Email: 'emma.wilson@test.com' },
  { RealName: 'James Chen',     Email: 'james.chen@test.com' },
  { RealName: 'Sofia Rodriguez',Email: 'sofia.rodriguez@test.com' },
  { RealName: 'Marcus Johnson', Email: 'marcus.johnson@test.com' },
  { RealName: 'Olivia Park',    Email: 'olivia.park@test.com' },
  { RealName: 'Liam Thompson',  Email: 'liam.thompson@test.com' },
  { RealName: 'Isabella Martinez', Email: 'isabella.martinez@test.com' },
  { RealName: 'Noah Williams',  Email: 'noah.williams@test.com' },
  { RealName: 'Ava Kim',        Email: 'ava.kim@test.com' },
  { RealName: 'Ethan Brown',    Email: 'ethan.brown@test.com' },
  { RealName: 'Mia Davis',      Email: 'mia.davis@test.com' },
  { RealName: 'Lucas Anderson', Email: 'lucas.anderson@test.com' },
];

// ── 24 Party templates (2 per user) ──
const PARTIES = [
  // Emma Wilson
  {
    Title: 'Rooftop Sunset Social',
    Description: 'Join us on a stunning rooftop in Williamsburg for sunset cocktails, good music, and even better company. Dress code: chic casual.',
    Address: '170 Bedford Ave',
    City: 'Brooklyn',
    GeoLat: 40.7178,
    GeoLon: -73.9562,
    PartyType: 'Rooftop Party',
    VibeTags: ['Chic', 'Social', 'Sunset'],
    Rules: ['Be respectful', 'No photos without consent', '21+'],
    MaxCapacity: 60,
    DurationHours: 4,
  },
  {
    Title: 'Vinyl & Wine Night',
    Description: 'Bring your favorite vinyl records for a cozy evening of music discovery, fine wine, and great conversation in a loft space.',
    Address: '255 Grand St',
    City: 'Brooklyn',
    GeoLat: 40.7132,
    GeoLon: -73.9564,
    PartyType: 'House Party',
    VibeTags: ['Cozy', 'Music', 'Wine'],
    Rules: ['Bring a record', 'No spilling wine on the vinyl', 'Be cool'],
    MaxCapacity: 30,
    DurationHours: 4,
  },
  // James Chen
  {
    Title: 'Board Game Bonanza',
    Description: 'Epic board game night with craft beer flights. We have Catan, Codenames, Ticket to Ride, and more! Beginners welcome.',
    Address: '87 N 11th St',
    City: 'Brooklyn',
    GeoLat: 40.7185,
    GeoLon: -73.9578,
    PartyType: 'Game Night',
    VibeTags: ['Fun', 'Games', 'Beer'],
    Rules: ['No cheating', 'Good sportsmanship', 'Bring your favorite game'],
    MaxCapacity: 24,
    DurationHours: 4,
  },
  {
    Title: 'Indie Film Screening',
    Description: 'Curated short films from local independent filmmakers followed by a Q&A and discussion. Popcorn and drinks provided.',
    Address: '30 Lafayette Ave',
    City: 'Brooklyn',
    GeoLat: 40.6870,
    GeoLon: -73.9776,
    PartyType: 'Movie Night',
    VibeTags: ['Artsy', 'Film', 'Discussion'],
    Rules: ['Silence during screening', 'Q&A encouraged', 'Arrive on time'],
    MaxCapacity: 40,
    DurationHours: 3,
  },
  // Sofia Rodriguez
  {
    Title: 'Art & Fashion Pop-Up',
    Description: 'Live painting, a mini fashion show, and an exhibition of emerging artists. Mingle with creatives and maybe find your next statement piece.',
    Address: '97 Allen St',
    City: 'Manhattan',
    GeoLat: 40.7189,
    GeoLon: -73.9906,
    PartyType: 'Art Show',
    VibeTags: ['Art', 'Fashion', 'Creative'],
    Rules: ['Ask before touching art', 'Photography encouraged with hashtag', 'Dress to impress'],
    MaxCapacity: 80,
    DurationHours: 5,
  },
  {
    Title: 'Wine & Watercolor Night',
    Description: 'Unwind with a glass of wine and guided watercolor painting. No experience needed — just bring your creative spirit!',
    Address: '175 Ludlow St',
    City: 'Manhattan',
    GeoLat: 40.7209,
    GeoLon: -73.9880,
    PartyType: 'Workshop',
    VibeTags: ['Creative', 'Relaxed', 'Wine'],
    Rules: ['Aprons provided', 'Have fun', 'Share your art'],
    MaxCapacity: 25,
    DurationHours: 3,
  },
  // Marcus Johnson
  {
    Title: 'Bushwick Beat Session',
    Description: 'Underground DJ set in a converted warehouse. Expect house, techno, and amazing vibes. Bring your dancing shoes.',
    Address: '56 Bogart St',
    City: 'Brooklyn',
    GeoLat: 40.7050,
    GeoLon: -73.9329,
    PartyType: 'DJ Night',
    VibeTags: ['Music', 'Dancing', 'Underground'],
    Rules: ['No phones on dance floor', 'Respect the space', 'Hydrate'],
    MaxCapacity: 150,
    DurationHours: 6,
  },
  {
    Title: 'Producer Meetup & Beat Battle',
    Description: 'Open decks for producers to showcase their tracks. Beat battle with prizes. Network with fellow music creators.',
    Address: '1325 Gates Ave',
    City: 'Brooklyn',
    GeoLat: 40.6897,
    GeoLon: -73.9265,
    PartyType: 'Meetup',
    VibeTags: ['Music', 'Networking', 'Competition'],
    Rules: ['Sign up for decks in advance', 'No hate speech in lyrics', 'Support other artists'],
    MaxCapacity: 60,
    DurationHours: 5,
  },
  // Olivia Park
  {
    Title: 'Sunrise Yoga & Brunch',
    Description: 'Start your day with a rooftop sunrise yoga session followed by a healthy organic brunch. All levels welcome.',
    Address: '80 N 5th St',
    City: 'Brooklyn',
    GeoLat: 40.7165,
    GeoLon: -73.9607,
    PartyType: 'Wellness',
    VibeTags: ['Wellness', 'Yoga', 'Brunch'],
    Rules: ['Bring your own mat', 'Arrive by 6:30 AM', 'No phones during practice'],
    MaxCapacity: 20,
    DurationHours: 3,
  },
  {
    Title: 'Mindful Mixer',
    Description: 'A sober social event focused on genuine connection. Tea, mocktails, conversation starters, and a judgment-free zone.',
    Address: '168 Suffolk St',
    City: 'Manhattan',
    GeoLat: 40.7205,
    GeoLon: -73.9855,
    PartyType: 'Social',
    VibeTags: ['Mindful', 'Connection', 'Sober'],
    Rules: ['Be present', 'No judgment', 'Phones away'],
    MaxCapacity: 35,
    DurationHours: 3,
  },
  // Liam Thompson
  {
    Title: 'Whiskey Tasting & Architecture Talk',
    Description: 'A curated whiskey tasting paired with a talk on NYC architecture. Hosted in a beautifully designed loft in DUMBO.',
    Address: '45 Main St',
    City: 'Brooklyn',
    GeoLat: 40.7030,
    GeoLon: -73.9908,
    PartyType: 'Tasting',
    VibeTags: ['Whiskey', 'Architecture', 'Educational'],
    Rules: ['21+ ID required', 'Sip don\'t chug', 'Ask questions'],
    MaxCapacity: 30,
    DurationHours: 3,
  },
  {
    Title: 'Rooftop Blueprint Party',
    Description: 'Celebrate good design with good company on a stunning DUMBO rooftop with skyline views of Manhattan.',
    Address: '20 Jay St',
    City: 'Brooklyn',
    GeoLat: 40.7040,
    GeoLon: -73.9868,
    PartyType: 'Rooftop Party',
    VibeTags: ['Views', 'Design', 'Social'],
    Rules: ['No glass near edge', 'Respect the views', 'Photo pass available'],
    MaxCapacity: 50,
    DurationHours: 4,
  },
  // Isabella Martinez
  {
    Title: 'Photography Walk & Gallery Night',
    Description: 'Guided photography walk through the Lower East Side followed by a private gallery viewing. Bring your camera!',
    Address: '100 Stanton St',
    City: 'Manhattan',
    GeoLat: 40.7210,
    GeoLon: -73.9875,
    PartyType: 'Photography Tour',
    VibeTags: ['Photography', 'Art', 'Exploration'],
    Rules: ['Respect private property', 'Share your best shots', 'Stay with the group'],
    MaxCapacity: 20,
    DurationHours: 4,
  },
  {
    Title: 'Polaroid Portrait Party',
    Description: 'A fun portrait party where everyone gets a Polaroid taken and creates a collaborative photo wall. Drinks and music included.',
    Address: '195 Chrystie St',
    City: 'Manhattan',
    GeoLat: 40.7223,
    GeoLon: -73.9930,
    PartyType: 'Party',
    VibeTags: ['Fun', 'Photography', 'Social'],
    Rules: ['Pose creatively', 'Keep your Polaroid', 'Sign the wall'],
    MaxCapacity: 40,
    DurationHours: 4,
  },
  // Noah Williams
  {
    Title: 'Founders & Funders Mixer',
    Description: 'Exclusive networking event for entrepreneurs and investors. Pitch sessions, panel discussion, and open bar.',
    Address: '601 W 26th St',
    City: 'Manhattan',
    GeoLat: 40.7514,
    GeoLon: -74.0055,
    PartyType: 'Networking',
    VibeTags: ['Business', 'Networking', 'Startups'],
    Rules: ['Bring business cards', 'No hard pitches on the dance floor', 'Dress code: business casual'],
    MaxCapacity: 100,
    DurationHours: 4,
  },
  {
    Title: 'Private Dinner Salon',
    Description: 'Intimate dinner party with thought leaders across tech, art, and finance. Family-style dining with curated conversation topics.',
    Address: '35 Howard St',
    City: 'Manhattan',
    GeoLat: 40.7192,
    GeoLon: -73.9981,
    PartyType: 'Dinner Party',
    VibeTags: ['Intimate', 'Intellectual', 'Culinary'],
    Rules: ['RSVP only', 'Come with an open mind', 'No plus-ones unless approved'],
    MaxCapacity: 16,
    DurationHours: 4,
  },
  // Ava Kim
  {
    Title: 'Study Break Party',
    Description: 'Post-exams celebration with pizza, karaoke, and board games. Decompress with fellow students and young professionals.',
    Address: '2896 Broadway',
    City: 'Manhattan',
    GeoLat: 40.8060,
    GeoLon: -73.9658,
    PartyType: 'Party',
    VibeTags: ['Fun', 'Karaoke', 'Casual'],
    Rules: ['No talking about exams', 'Song requests welcome', 'Pizza first, talk later'],
    MaxCapacity: 50,
    DurationHours: 5,
  },
  {
    Title: 'Weekend Brunch Club',
    Description: 'Bottomless brunch with a rotating theme. This month: tropical. Mimosas, live acoustic music, and great company.',
    Address: '1470 2nd Ave',
    City: 'Manhattan',
    GeoLat: 40.7715,
    GeoLon: -73.9565,
    PartyType: 'Brunch',
    VibeTags: ['Brunch', 'Casual', 'Music'],
    Rules: ['Bottomless means bottomless', 'Tip your server', 'Birthday celebrations welcome'],
    MaxCapacity: 40,
    DurationHours: 3,
  },
  // Ethan Brown
  {
    Title: 'Farm-to-Table Dinner Experience',
    Description: 'A five-course tasting menu using locally sourced ingredients. Each course paired with a complementary wine. Hosted in a private dining room.',
    Address: '11 Madison Ave',
    City: 'Manhattan',
    GeoLat: 40.7417,
    GeoLon: -73.9871,
    PartyType: 'Dinner Party',
    VibeTags: ['Culinary', 'Fine Dining', 'Wine'],
    Rules: ['Dietary restrictions must be shared 48h in advance', 'Dress code: formal', 'No phones at the table'],
    MaxCapacity: 12,
    DurationHours: 3,
  },
  {
    Title: 'Pasta-Making Workshop',
    Description: 'Learn to make fresh pasta from scratch! Hands-on workshop followed by dinner where we eat what we make. All ingredients provided.',
    Address: '54 E 1st St',
    City: 'Manhattan',
    GeoLat: 40.7240,
    GeoLon: -73.9905,
    PartyType: 'Workshop',
    VibeTags: ['Cooking', 'Hands-on', 'Italian'],
    Rules: ['Wear comfortable clothes', 'Bring your appetite', 'Flour will get everywhere (that\'s the fun part)'],
    MaxCapacity: 16,
    DurationHours: 3,
  },
  // Mia Davis
  {
    Title: 'Design Thinking Happy Hour',
    Description: 'Casual happy hour for designers, creatives, and tech enthusiasts. Lightning talks, sketch sessions, and great drinks.',
    Address: '76 9th Ave',
    City: 'Manhattan',
    GeoLat: 40.7427,
    GeoLon: -74.0052,
    PartyType: 'Happy Hour',
    VibeTags: ['Design', 'Tech', 'Networking'],
    Rules: ['Bring your portfolio if you want feedback', 'No recruiters (this is social)', 'Sketch on the provided paper'],
    MaxCapacity: 50,
    DurationHours: 3,
  },
  {
    Title: 'Cozy Movie Night: Sci-Fi Edition',
    Description: 'Blankets, popcorn, and a curated sci-fi double feature on a big screen. Discussion after each film. BYO blanket!',
    Address: '232 E 11th St',
    City: 'Manhattan',
    GeoLat: 40.7306,
    GeoLon: -73.9885,
    PartyType: 'Movie Night',
    VibeTags: ['Cozy', 'Sci-Fi', 'Relaxed'],
    Rules: ['No spoilers', 'Blankets provided if you forget', 'Vote for next month\'s theme'],
    MaxCapacity: 25,
    DurationHours: 4,
  },
  // Lucas Anderson
  {
    Title: 'Poker & Portfolios Night',
    Description: 'High-stakes poker (fake money) for venture capitalists and founders. Prizes for winners, networking for all.',
    Address: '100 5th Ave',
    City: 'Manhattan',
    GeoLat: 40.7401,
    GeoLon: -73.9925,
    PartyType: 'Game Night',
    VibeTags: ['Poker', 'Networking', 'Exclusive'],
    Rules: ['Blind levels posted', 'No real money', 'Best bluff wins a prize'],
    MaxCapacity: 24,
    DurationHours: 4,
  },
  {
    Title: 'Yacht Sunset Cruise',
    Description: 'An evening sailing around Manhattan on a private yacht. Cocktails, canapés, and the best views of the skyline.',
    Address: 'Pier 25 Hudson River',
    City: 'Manhattan',
    GeoLat: 40.7243,
    GeoLon: -74.0150,
    PartyType: 'Boat Party',
    VibeTags: ['Luxury', 'Sunset', 'Exclusive'],
    Rules: ['Arrive at the pier 15min early', 'No heels that damage deck', 'Sea bands available if prone to motion sickness'],
    MaxCapacity: 40,
    DurationHours: 4,
  },
];

// ── Helpers ──
function postJson(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: responseData, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function createPartyViaWS(sessionToken, partyData, partyIndex) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket timeout for party: ${partyData.Title}`));
    }, 10000);

    ws.on('open', () => {
      const aMonthFromNow = new Date();
      aMonthFromNow.setMonth(aMonthFromNow.getMonth() + 1);
      aMonthFromNow.setHours(19, 0, 0, 0);

      const startTime = new Date(aMonthFromNow);
      startTime.setHours(startTime.getHours() + Math.floor(Math.random() * 8));

      const chatRoomID = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const photos = PARTY_PHOTOS_SETS[partyIndex] || [
        `https://picsum.photos/seed/party_${partyIndex}/400/300`,
      ];

      const payload = {
        Event: 'CREATE_PARTY',
        SessionToken: sessionToken,
        Payload: {
          ...partyData,
          StartTime: startTime.toISOString(),
          ChatRoomID: chatRoomID,
          PartyPhotos: photos,
          CrowdfundTarget: 0,
        },
      };

      ws.send(JSON.stringify(payload));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      clearTimeout(timeout);
      ws.close();
      if (response.Event === 'PARTY_CREATED' || response.Event === 'FEED_UPDATE') {
        resolve(response);
      } else if (response.Event === 'ERROR') {
        reject(new Error(`Party creation error: ${JSON.stringify(response.Payload)}`));
      } else {
        resolve(response);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ── Main ──
async function main() {
  console.log('=== WaterParty Seed Data Script ===\n');
  console.log(`Starting: ${new Date().toISOString()}\n`);

  const registeredUsers = [];

  // Step 1: Register all 12 users
  console.log('─'.repeat(60));
  console.log('STEP 1: REGISTERING 12 USERS\n');

  for (let i = 0; i < USERS.length; i++) {
    const user = USERS[i];
    const password = 'password123';

    // Unique email with test suffix
    const email = user.Email.replace('@', `+test${i}_${Date.now()}@`);

    try {
      console.log(`  [${i + 1}/12] Registering ${user.RealName} (${email})...`);
      const result = await postJson('/register', {
        password,
        user: {
          RealName: user.RealName,
          Email: email,
          ProfilePhotos: PROFILE_PHOTOS[i],
        },
      });

      if (result.status === 200) {
        const { user: registeredUser, sessionId } = result.data;
        console.log(`     ✓ User ID: ${registeredUser.ID}`);
        console.log(`     ✓ Session: ${sessionId}`);
        registeredUsers.push({
          ...user,
          Email: email,
          Password: password,
          ID: registeredUser.ID,
          SessionToken: sessionId,
        });
      } else {
        console.error(`     ✗ Error (${result.status}): ${JSON.stringify(result.data)}`);
        // Retry with a unique timestamp-based email
        const altEmail = user.Email.replace('@', `+test${i}_${Date.now()}_retry@`);
        console.log(`     Retrying with ${altEmail}...`);
        const retry = await postJson('/register', {
          password,
          user: {
            RealName: user.RealName,
            Email: altEmail,
            ProfilePhotos: PROFILE_PHOTOS[i],
          },
        });
        if (retry.status === 200) {
          console.log(`     ✓ User ID: ${retry.data.user.ID}`);
          registeredUsers.push({
            ...user,
            Email: altEmail,
            Password: password,
            ID: retry.data.user.ID,
            SessionToken: retry.data.sessionId,
          });
        } else {
          console.error(`     ✗ Failed: ${JSON.stringify(retry.data)}`);
        }
      }
    } catch (err) {
      console.error(`     ✗ Error: ${err.message}`);
    }
  }

  console.log(`\n  Registered ${registeredUsers.length}/${USERS.length} users\n`);

  // Step 2: Create 2 parties per user
  console.log('─'.repeat(60));
  console.log('STEP 2: CREATING PARTIES\n');

  let partyCount = 0;
  for (let u = 0; u < registeredUsers.length; u++) {
    const user = registeredUsers[u];
    const userParties = PARTIES.slice(u * 2, u * 2 + 2);

    for (let p = 0; p < userParties.length; p++) {
      const partyIndex = u * 2 + p;
      const party = userParties[p];
      partyCount++;
      try {
        console.log(`  [${partyCount}/24] ${user.RealName}: "${party.Title}"...`);
        await createPartyViaWS(user.SessionToken, party, partyIndex);
        console.log(`     ✓ Created`);
      } catch (err) {
        console.error(`     ✗ ${err.message}`);
      }
    }
  }

  console.log(`\n  Created ${partyCount} parties\n`);

  // Step 3: Output summary
  console.log('─'.repeat(60));
  console.log('SEED COMPLETE');
  console.log(`  Users: ${registeredUsers.length}`);
  console.log(`  Parties: ${partyCount}`);
  console.log(`  Time: ${new Date().toISOString()}\n`);

  // Print credentials for the markdown file
  console.log('─'.repeat(60));
  console.log('CREDENTIALS FOR testaccounts.md:\n');

  for (const u of registeredUsers) {
    const userParties = PARTIES.slice(registeredUsers.indexOf(u) * 2, registeredUsers.indexOf(u) * 2 + 2);
    console.log(`  User: ${u.RealName}`);
    console.log(`  Email: ${u.Email}`);
    console.log(`  Password: ${u.Password}`);
    console.log(`  ID: ${u.ID}`);
    console.log(`  Parties:`);
    for (const p of userParties) {
      console.log(`    - ${p.Title} (${p.City})`);
    }
    console.log();
  }
}

main().catch(console.error);
