const twilio = require("twilio");

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  let incomingMessage = "";
  if (req.body) {
    if (typeof req.body === "object" && req.body.Body) {
      incomingMessage = req.body.Body;
    } else if (typeof req.body === "string") {
      const params = new URLSearchParams(req.body);
      incomingMessage = params.get("Body") || req.body;
    }
  }

  let reply;
  if (incomingMessage.toLowerCase().trim() === "hello") {
    reply = "Hello! 👋 Welcome to our Mandi Price Assistant.";
  } else if (incomingMessage.trim()) {
    reply = `You said: "${incomingMessage}"\n\nOur Mandi Price Assistant is working! 🌾`;
  } else {
    reply = "Welcome to SahiBhaav Mandi Price Assistant! 🌾 Send a crop name to check mandi rates.";
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);

  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(twiml.toString());
};
