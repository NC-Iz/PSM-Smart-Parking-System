const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ─── TOYYIBPAY CONFIG ─────────────────────────────────────
const TOYYIBPAY_SECRET_KEY = "t2e93ldc-szop-sl6x-qrsr-406hs7sl1ufo"; // Paste your secret key here
const TOYYIBPAY_CATEGORY_CODE = "5di4a3bg"; // Paste your category code here
const TOYYIBPAY_BASE_URL = "https://dev.toyyibpay.com"; // Change to https://toyyibpay.com for production
// ──────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// FUNCTION 1: createBill
// Called by mobile app when user taps Top Up
// Creates a Toyyibpay bill and returns the payment URL
// ─────────────────────────────────────────────────────────
exports.createBill = functions.https.onRequest(async (req, res) => {
  // Allow cross-origin requests from mobile app
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

    // Map payment method to Toyyibpay channel
    const channelMap = {
      fpx: "0", // FPX only
      card: "1", // Credit/Debit card only
      tng: "2", // Touch n Go only
    };
    const billPaymentChannel = channelMap[paymentMethod] || "0";

    // Validate inputs
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

    // Toyyibpay uses cents (sen) — RM 20.00 = 2000
    const amountInSen = Math.round(parseFloat(amount) * 100);

    // Unique bill reference
    const billRef = `TOPUP_${userId.slice(0, 8)}_${Date.now()}`;

    // Get Cloud Function URLs dynamically
    const region = "us-central1";
    const projectId = process.env.GCLOUD_PROJECT;
    const baseCallbackUrl = `https://${region}-${projectId}.cloudfunctions.net`;

    // Prepare Toyyibpay bill payload
    const payload = new URLSearchParams({
      userSecretKey: TOYYIBPAY_SECRET_KEY,
      categoryCode: TOYYIBPAY_CATEGORY_CODE,
      billName: "Wallet Top Up",
      billDescription: `Smart Parking wallet top up - RM ${parseFloat(amount).toFixed(2)}`,
      billPriceSetting: "1", // 1 = fixed amount
      billPayorInfo: "1", // 1 = require payer info
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
      billChargeToCustomer: "0", // 0 = merchant absorbs charges
    });

    // Call Toyyibpay API
    const response = await axios.post(
      `${TOYYIBPAY_BASE_URL}/index.php/api/createBill`,
      payload.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const result = response.data;

    // Toyyibpay returns [{ BillCode: "xxxxx" }] on success
    if (Array.isArray(result) && result.length > 0 && result[0].BillCode) {
      const billCode = result[0].BillCode;
      const paymentUrl = `${TOYYIBPAY_BASE_URL}/${billCode}`;

      // Save pending top-up to Firestore so callback can find userId
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
// Updates wallet balance in Firestore
// ─────────────────────────────────────────────────────────
exports.paymentCallback = functions.https.onRequest(async (req, res) => {
  try {
    // Parse multipart/form-data from Toyyibpay
    const fields = await parseMultipart(req);

    console.log("=== PARSED FIELDS ===");
    console.log(JSON.stringify(fields));
    console.log("====================");

    const refNo = fields.refno || "";
    const status = fields.status || "";
    const billCode = fields.billcode || "";
    const orderId = fields.order_id || "";
    const amountSen = fields.amount || "0";

    console.log(`💳 Payment callback received`);
    console.log(`   Bill Code: ${billCode}`);
    console.log(`   Status: ${status}`);
    console.log(`   Ref No: ${refNo}`);
    console.log(`   Amount: ${amountSen} sen`);

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

    const userRef = db.collection("users").doc(userId);
    batch.update(userRef, {
      walletBalance: admin.firestore.FieldValue.increment(amountRM),
    });

    batch.update(pendingRef, {
      status: "completed",
      refNo: refNo,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    console.log(`✅ Wallet updated: +RM ${amountRM} for user ${userId}`);
    console.log(`✅ Transaction recorded: ${transactionId}`);

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ paymentCallback error:", error.message);
    res.status(200).send("OK");
  }
});

// ─────────────────────────────────────────────────────────
// FUNCTION 3: paymentReturn
// User is redirected here after completing payment in browser
// Shows a simple success/fail page
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
