const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
    const paymentCollection = db.collection('payments')
    const reviewsCollection = db.collection('reviews')

    app.get('/api/users', async (req, res)=> {
      const result = await userCollection.find().toArray();
      res.json(result)
    });


    app.get("/api/all/doctors", async (req, res) => {
  try {
    const doctors = await doctorCollection.find({}).toArray();

    res.status(200).json({
      success: true,
      message: "Doctors fetched successfully",
      data: doctors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch doctors",
      error: error.message,
    });
  }
});
    app.get("/api/doctors", async (req, res) => {
  try {
    const query = {};

    if (req.query.doctorId) {
      query._id = new ObjectId(req.query.doctorId);
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch doctors",
    });
  }
});

app.get("/api/doctor", async (req, res) => {
  const query = {};

  if (req.query.doctorId) {
    query.doctorId = req.query.doctorId;
  }

  const result = await doctorCollection.find(query).toArray();
  console.log("Result:", result);

  res.json({
    success: true,
    data: result,
  });
});
app.get("/api/doctors/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await doctorCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post("/api/doctors", async (req, res) => {
  try {
    const doctorData = req.body;

    const existingDoctor = await doctorCollection.findOne({
      doctorId: doctorData.doctorId,
    });

    if (existingDoctor) {
      return res.status(409).json({
        success: false,
        message: "Doctor profile already exists",
      });
    }

    doctorData.status = "Pending";
    doctorData.createdAt = new Date();

    const result = await doctorCollection.insertOne(doctorData);

    res.status(201).json({
      success: true,
      message: "Doctor profile submitted successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.post("/api/payments", async (req, res) => {
  try {
    const payment = req.body;

    const createdPayment = {
      patientId: payment.patientId,
      patientName: payment.patientName,
      patientEmail: payment.patientEmail,

      doctorId: payment.doctorId,
      doctorName: payment.doctorName,
      doctorImage: payment.doctorImage,
      doctorHospital: payment.doctorHospital,
      doctorSpecialization: payment.Specialization,

      appointmentDate: payment.appointmentDate,
      appointmentSlot: payment.appointmentSlot,
      symptoms: payment.symptoms,

      amount: Number(payment.amount),

      stripeSessionId: payment.stripeSessionId,
      paymentIntentId: payment.paymentIntentId,
      appointmentStatus: payment.appointmentStatus,

      paymentStatus: "Paid",
      createdAt: new Date(),
    };

    const result = await paymentCollection.insertOne(createdPayment);

    res.send(result);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/payments", async (req, res) => {
  try {
    const { patientId, doctorId, paymentStatus } = req.query;

    const query = {};

    if (patientId) {
      query.patientId = patientId;
    }

    if (doctorId) {
      query.doctorId = doctorId;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    const payments = await paymentCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(payments);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});
app.patch("/api/payments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { appointmentDate, appointmentSlot } = req.body;

    const filter = {
      _id: new ObjectId(id),
    };

    const updateDoc = {
      $set: {
        appointmentDate,
        appointmentSlot,
      },
    };

    const result = await paymentCollection.updateOne(filter, updateDoc);

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed to reschedule appointment",
    });
  }
});
app.delete("/api/payments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await paymentCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Appointment not found",
      });
    }

    res.send({
      success: true,
      message: "Appointment cancelled successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const review = req.body;

    const result = await reviewsCollection.insertOne({
      ...review,
      createdAt: new Date(),
    });

    res.status(201).send({
      success: true,
      message: "Review submitted successfully.",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to submit review.",
      error: error.message,
    });
  }
});
app.get("/api/reviews", async (req, res) => {
  try {
    const { patientId } = req.query;

    const query = {};

    if (patientId) {
      query.patientId = patientId;
    }

    const reviews = await reviewsCollection.find(query).sort({ createdAt: -1 }).toArray();

    res.status(200).send({
      success: true,
      data: reviews,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to fetch reviews.",
      error: error.message,
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