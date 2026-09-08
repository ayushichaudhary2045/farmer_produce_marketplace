const twilio = require("twilio");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const incomingMessage = req.body?.Body || "";

  let reply;

  if (incomingMessage.toLowerCase().trim() === "hello") {
    reply = "Hello! 👋 Welcome to our Mandi Price Assistant.";
  } else {
    reply = `You said: "${incomingMessage}"\n\nOur Mandi Price Assistant is working! 🌾`;
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);

  res.type("text/xml");
  res.send(twiml.toString());
};
