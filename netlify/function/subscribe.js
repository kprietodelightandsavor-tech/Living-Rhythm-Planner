// ─────────────────────────────────────────────────────────────────────────────
// Netlify Function: subscribe.js
// Adds a subscriber to MailerLite with the correct group tag
// Called from the Living Rhythm Planner login screen
//
// SETUP: Add MAILERLITE_API_KEY to your Netlify environment variables
// ─────────────────────────────────────────────────────────────────────────────

exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const API_KEY = process.env.MAILERLITE_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "MailerLite API key not configured" })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { email, name, tag } = body;
  if (!email || !name) {
    return { statusCode: 400, body: JSON.stringify({ error: "Email and name required" }) };
  }

  // Determine group name based on tag
  // "beta" → Early Roots beta testers
  // "subscriber" → paid annual subscribers
  const groupName = tag === "beta"
    ? "Living Rhythm — Early Roots"
    : "Living Rhythm — Subscribers";

  try {
    // Step 1: Create or update the subscriber
    const subscriberRes = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        fields: {
          name: name.trim(),
          last_name: ""
        },
        groups: [],
        status: "active"
      })
    });

    const subscriberData = await subscriberRes.json();

    if (!subscriberRes.ok) {
      // Subscriber might already exist — that's fine
      console.log("Subscriber response:", JSON.stringify(subscriberData));
    }

    const subscriberId = subscriberData?.data?.id;

    // Step 2: Find or create the group
    const groupsRes = await fetch("https://connect.mailerlite.com/api/groups?filter[name]=" + encodeURIComponent(groupName), {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      }
    });
    const groupsData = await groupsRes.json();
    let groupId = groupsData?.data?.[0]?.id;

    // Create group if it doesn't exist
    if (!groupId) {
      const createGroupRes = await fetch("https://connect.mailerlite.com/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ name: groupName })
      });
      const createGroupData = await createGroupRes.json();
      groupId = createGroupData?.data?.id;
    }

    // Step 3: Add subscriber to group
    if (subscriberId && groupId) {
      await fetch(`https://connect.mailerlite.com/api/subscribers/${subscriberId}/groups/${groupId}`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        }
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, message: "Subscriber added" })
    };

  } catch (err) {
    console.error("MailerLite error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
