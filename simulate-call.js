// simulate-call.js
const WEBHOOK_URL = 'https://online-database-chi.vercel.app/api/webhooks/ringcentral';

const mockCallData = {
  timestamp: new Date().toISOString(),
  subscriptionId: "test-subscription-id",
  body: {
    extensionId: "12345678",
    telephonySessionId: "s-mock-session-id-" + Math.floor(Math.random() * 1000),
    parties: [
      {
        direction: "Inbound",
        from: {
          phoneNumber: "+15550009999", // Change this to test different numbers
          name: "Test Caller"
        },
        status: { code: "Setup" } // This indicates the call is ringing
      }
    ]
  }
};

async function sendMockCall() {
  console.log("Sending mock call to:", WEBHOOK_URL);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockCallData)
    });

    const result = await response.json();
    console.log("Response from server:", result);
  } catch (error) {
    console.error("Error sending mock call:", error);
  }
}

sendMockCall();