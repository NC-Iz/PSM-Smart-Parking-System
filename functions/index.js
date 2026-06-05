const functions = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const axios = require("axios");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ─── TOYYIBPAY CONFIG ─────────────────────────────────────
const TOYYIBPAY_SECRET_KEY = "t2e93ldc-szop-sl6x-qrsr-406hs7sl1ufo";
const TOYYIBPAY_CATEGORY_CODE = "5di4a3bg";
const TOYYIBPAY_BASE_URL = "https://dev.toyyibpay.com"; // Change to https://toyyibpay.com for production
// ──────────────────────────────────────────────────────────

// ─── PUSH NOTIFICATION HELPER ─────────────────────────────
async function sendPushNotification(userId, title, body) {
  try {
    const userSnap = await db.collection("users").doc(userId).get();
    const pushToken = userSnap.data()?.pushToken;

    if (!pushToken) {
      console.log(`[Push] No push token for user ${userId}`);
      return;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        title: title,
        body: body,
        sound: "default",
        priority: "high",
      }),
    });

    const result = await response.json();
    console.log(`[Push] Sent to ${userId}:`, result);
  } catch (error) {
    // Non-blocking — don't fail main function if push fails
    console.warn(`[Push] Failed for user ${userId}:`, error.message);
  }
}
// ──────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// FUNCTION 1: onNotificationCreated
// Fires whenever a new document is added to the notifications collection
// Sends a push notification to the user automatically
// ─────────────────────────────────────────────────────────
exports.onNotificationCreated = onDocumentCreated("notifications/{notificationId}", async (event) => {
    const data = event.data?.data();
    if (!data?.userId || !data?.title || !data?.message) return;
    await sendPushNotification(data.userId, data.title, data.message);
  });

// ─────────────────────────────────────────────────────────
// FUNCTION 2: createBill
// Called by mobile app when user taps Top Up
// Creates a Toyyibpay bill and returns the payment URL
// ─────────────────────────────────────────────────────────
exports.createBill = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { userId, amount, userEmail, userName, userPhone, paymentMethod } =
      req.body;

    const channelMap = {
      fpx: "0",
      card: "1",
      tng: "2",
    };
    const billPaymentChannel = channelMap[paymentMethod] || "0";

    if (!userId || !amount) {
      res.status(400).json({ error: "userId and amount are required" });
      return;
    }

    if (amount < 1) {
      res.status(400).json({ error: "Minimum top up is RM 1.00" });
      return;
    }

    if (amount > 500) {
      res.status(400).json({ error: "Maximum top up is RM 500.00" });
      return;
    }

    const amountInSen = Math.round(parseFloat(amount) * 100);
    const billRef = `TOPUP_${userId.slice(0, 8)}_${Date.now()}`;

    const region = "us-central1";
    const projectId = process.env.GCLOUD_PROJECT;
    const baseCallbackUrl = `https://${region}-${projectId}.cloudfunctions.net`;

    const payload = new URLSearchParams({
      userSecretKey: TOYYIBPAY_SECRET_KEY,
      categoryCode: TOYYIBPAY_CATEGORY_CODE,
      billName: "Wallet Top Up",
      billDescription: `Smart Parking wallet top up - RM ${parseFloat(amount).toFixed(2)}`,
      billPriceSetting: "1",
      billPayorInfo: "1",
      billAmount: amountInSen.toString(),
      billReturnUrl: `${baseCallbackUrl}/paymentReturn`,
      billCallbackUrl: `${baseCallbackUrl}/paymentCallback`,
      billExternalReferenceNo: billRef,
      billTo: userName || "User",
      billEmail: userEmail || "",
      billPhone: userPhone || "",
      billSplitPayment: "0",
      billSplitPaymentArgs: "",
      billPaymentChannel: billPaymentChannel,
      billContentEmail: `Thank you for topping up your Smart Parking wallet with RM ${parseFloat(amount).toFixed(2)}.`,
      billChargeToCustomer: "0",
    });

    const response = await axios.post(
      `${TOYYIBPAY_BASE_URL}/index.php/api/createBill`,
      payload.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const result = response.data;

    if (Array.isArray(result) && result.length > 0 && result[0].BillCode) {
      const billCode = result[0].BillCode;
      const paymentUrl = `${TOYYIBPAY_BASE_URL}/${billCode}`;

      await db
        .collection("pendingTopups")
        .doc(billCode)
        .set({
          userId: userId,
          billCode: billCode,
          billRef: billRef,
          amount: parseFloat(amount),
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(
        `✅ Bill created: ${billCode} for user ${userId} - RM ${amount}`,
      );

      res.status(200).json({
        success: true,
        billCode: billCode,
        paymentUrl: paymentUrl,
        billRef: billRef,
        amount: parseFloat(amount),
      });
    } else {
      console.error("❌ Toyyibpay error:", result);
      res.status(500).json({
        error: "Failed to create bill",
        details: JSON.stringify(result),
      });
    }
  } catch (error) {
    console.error("❌ createBill error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper: parse multipart/form-data
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const Busboy = require("busboy");
    const fields = {};

    const busboy = Busboy({ headers: req.headers });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("finish", () => resolve(fields));
    busboy.on("error", (err) => reject(err));

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
}

// ─────────────────────────────────────────────────────────
// FUNCTION 2: paymentCallback
// Toyyibpay calls this automatically after payment
// Updates wallet balance in Firestore + sends push notification
// ─────────────────────────────────────────────────────────
exports.paymentCallback = functions.https.onRequest(async (req, res) => {
  try {
    const fields = await parseMultipart(req);

    console.log("=== PARSED FIELDS ===");
    console.log(JSON.stringify(fields));
    console.log("====================");

    const refNo = fields.refno || "";
    const status = fields.status || "";
    const billCode = fields.billcode || "";
    const orderId = fields.order_id || "";

    console.log(`💳 Payment callback received`);
    console.log(`   Bill Code: ${billCode}`);
    console.log(`   Status: ${status}`);
    console.log(`   Ref No: ${refNo}`);

    if (status !== "1") {
      console.log(`⚠️ Payment not successful (status=${status}), skipping`);
      res.status(200).send("OK");
      return;
    }

    const pendingRef = db.collection("pendingTopups").doc(billCode);
    const pendingDoc = await pendingRef.get();

    if (!pendingDoc.exists) {
      console.error(`❌ Pending top-up not found for bill: ${billCode}`);
      res.status(200).send("OK");
      return;
    }

    const pendingData = pendingDoc.data();
    const userId = pendingData.userId;

    if (pendingData.status === "completed") {
      console.log(`⚠️ Already processed, skipping duplicate callback`);
      res.status(200).send("OK");
      return;
    }

    const amountRM = pendingData.amount;

    const batch = db.batch();

    // Transaction record
    const transactionId = `txn_${Date.now()}`;
    const transactionRef = db.collection("transactions").doc(transactionId);
    batch.set(transactionRef, {
      transactionId: transactionId,
      userId: userId,
      type: "topup",
      amount: amountRM,
      description: "Wallet Top Up",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "completed",
      metadata: {
        paymentMethod: "Toyyibpay",
        referenceId: refNo,
        billCode: billCode,
        orderId: orderId,
      },
    });

    // Update wallet balance
    batch.update(db.collection("users").doc(userId), {
      walletBalance: admin.firestore.FieldValue.increment(amountRM),
    });

    // Mark pending topup as completed
    batch.update(pendingRef, {
      status: "completed",
      refNo: refNo,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    console.log(`✅ Wallet updated: +RM ${amountRM} for user ${userId}`);
    console.log(`✅ Transaction recorded: ${transactionId}`);

    const updatedUser = await db.collection("users").doc(userId).get();
    const newBalance = updatedUser.data()?.walletBalance ?? 0;

    // Top up notification with new balance
    await db.collection("notifications").doc(`notif_${Date.now()}`).set({
      userId: userId,
      type: "payment",
      title: "Top Up Successful",
      message: `RM ${amountRM.toFixed(2)} has been added to your wallet. Your new balance is RM ${newBalance.toFixed(2)}.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (newBalance < 5) {
      await db.collection("notifications").add({
        userId: userId,
        type: "warning",
        title: "Low Wallet Balance",
        message: `Your wallet balance is RM ${newBalance.toFixed(2)}. Top up soon to avoid parking payment issues.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `⚠️ Low balance warning sent to user ${userId} (RM ${newBalance.toFixed(2)})`,
      );
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ paymentCallback error:", error.message);
    res.status(200).send("OK");
  }
});

// ─────────────────────────────────────────────────────────
// FUNCTION 3: paymentReturn
// User is redirected here after completing payment in browser
// ─────────────────────────────────────────────────────────
exports.paymentReturn = functions.https.onRequest(async (req, res) => {
  const status = req.query.status_id || req.body.status_id || "";
  const billCode = req.query.billcode || req.body.billcode || "";

  if (status === "1") {
    res.status(200).send(`
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Successful</title>
      </head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f5f6fa;margin:0">
        <div style="background:white;padding:40px;border-radius:15px;max-width:400px;margin:auto;box-shadow:0 2px 10px rgba(0,0,0,0.1)">
          <div style="font-size:60px">✅</div>
          <h2 style="color:#27ae60;margin:15px 0 10px">Payment Successful!</h2>
          <p style="color:#7f8c8d;margin:0">Your wallet has been topped up successfully.</p>
          <p style="color:#7f8c8d;margin-top:8px">You can close this page and return to the app.</p>
          <p style="color:#bdc3c7;font-size:12px;margin-top:20px">Ref: ${billCode}</p>
        </div>
      </body>
      </html>
    `);
  } else {
    res.status(200).send(`
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Failed</title>
      </head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f5f6fa;margin:0">
        <div style="background:white;padding:40px;border-radius:15px;max-width:400px;margin:auto;box-shadow:0 2px 10px rgba(0,0,0,0.1)">
          <div style="font-size:60px">❌</div>
          <h2 style="color:#e74c3c;margin:15px 0 10px">Payment Failed</h2>
          <p style="color:#7f8c8d;margin:0">Your payment was not completed.</p>
          <p style="color:#7f8c8d;margin-top:8px">Please return to the app and try again.</p>
        </div>
      </body>
      </html>
    `);
  }
});
