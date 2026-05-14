export async function sendInstagramMessage(
  recipientId: string,
  message: string
): Promise<boolean> {
  const accessToken = process.env.INSTAGRAM_TOKEN;

  if (!accessToken) {
    console.error("[SendMessage] Missing INSTAGRAM_TOKEN");
    return false;
  }

  const url = `https://graph.instagram.com/v25.0/me/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: { text: message },
        recipient: { id: recipientId },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[SendMessage] Failed to send message:", data);
      return false;
    }

    console.log("[SendMessage] Message sent successfully:", data);
    return true;
  } catch (error) {
    console.error("[SendMessage] Error:", error);
    return false;
  }
}
