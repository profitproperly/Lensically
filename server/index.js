const express = require("express")
const cors = require("cors")
require("dotenv").config()
const threadsAuth = require("./auth/threadsAuth");

const app = express()

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
  res.send("Lensically API running")
})

app.use("/auth/threads", threadsAuth);

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
