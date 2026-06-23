const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const { MongoClient, ServerApiVersion } = require('mongodb');

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const app = express();
dotenv.config()

app.use(cors());
app.use(express.json());

const port = process.env.PORT
const uri = process.env.MONGO_URI

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    
    const db = client.db(process.env.AUTH_DB_NAME)
    const userCollection = db.collection('user')
    const doctorCollection = db.collection('doctors')

    app.get('/api/users', async (req, res)=> {
      const result = await userCollection.find().toArray();
      res.json(result)
    });

    
    app.get('/api/doctors', async (req, res) => {
  try {
    const query = {};

    if (req.query.doctorId) {
      query.doctorId = req.query.doctorId;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const result = await doctorCollection.find(query).toArray();

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch doctors",
    });
  }
});
    // Send a ping to confirm a successful connection
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Welcome to  Medicare Server')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})