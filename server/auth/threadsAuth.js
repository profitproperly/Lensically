const express = require("express");
const router = express.Router();

const THREADS_CLIENT_ID = process.env.THREADS_CLIENT_ID;
const REDIRECT_URI = "https://lensically-worker.lensically.workers.dev/auth/threads/callback";

router.get("/login", (req, res) => {

  const authURL =
    "https://threads.net/oauth/authorize" +
    `?client_id=${THREADS_CLIENT_ID}` +
    `&redirect_uri=${REDIRECT_URI}` +
    "&scope=threads_basic,threads_manage_insights,threads_keyword_search,threads_profile_discovery,threads_content_publish" +
    "&response_type=code";

  res.redirect(authURL);

});

router.get("/callback", async (req, res) => {

  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Missing OAuth code");
  }

  console.log("Threads OAuth code:", code);

  res.send("Threads OAuth callback received");

});

router.post("/uninstall", async (req, res) => {
  console.log("Threads app uninstall event received");
  res.status(200).send("ok");
});

router.post("/delete", async (req, res) => {
  console.log("Threads data deletion request received");
  res.status(200).send("ok");
});

module.exports = router;
