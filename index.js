const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
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

const { decodeProtectedHeader } = require("jose-cjs");


const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;

    next();
  } catch (err) {
    console.log(err);
    return res.status(403).json({
      message: "Forbidden",
    });
  }
};
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    
    const db = client.db(process.env.AUTH_DB_NAME)
    const userCollection = db.collection('user')
    const doctorCollection = db.collection('doctors')
    const paymentCollection = db.collection('payments')
    const reviewsCollection = db.collection('reviews')
    const prescriptionCollection = db.collection('prescription')
    const contactCollection = db.collection("contacts");

    app.get('/api/users',verifyToken, async (req, res)=> {
      const result = await userCollection.find().toArray();
      res.json(result)
    });

    app.patch("/api/users/:id/status",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `User ${status} successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.delete("/api/users/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await userCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


    app.get("/api/all/doctors",verifyToken, async (req, res) => {
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

app.get("/api/doctor",verifyToken, async (req, res) => {
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

app.post("/api/doctors",verifyToken, async (req, res) => {
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
      doctorSpecialization: payment.doctorSpecialization,

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

app.get("/api/payments",verifyToken, async (req, res) => {
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
app.patch("/api/payments/:id",verifyToken, async (req, res) => {
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
app.delete("/api/payments/:id",verifyToken, async (req, res) => {
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

app.patch("/api/my/payments/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { appointmentStatus } = req.body;

    const result = await paymentCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          appointmentStatus,
        },
      }
    );

    res.send({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.post("/api/reviews",verifyToken, async (req, res) => {
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

app.get("/api/reviews",verifyToken, async (req, res) => {
  try {
    const { patientId, doctorId } = req.query;

    const query = {};

    if (patientId) {
      query.patientId = patientId;
    }

    if (doctorId) {
      query.doctorId = doctorId;
    }

    const reviews = await reviewsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

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

app.get("/api/my/payments",verifyToken, async (req, res) => {
  try {
    const { patientId, doctorId } = req.query;

    const query = {};

    if (patientId) {
      query.patientId = patientId;
    }

    if (doctorId) {
      query.doctorId = doctorId;
    }

    const payments = await paymentCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(payments);
  } catch (err) {
    res.status(500).send({
      success: false,
      message: err.message,
    });
  }
});


app.patch("/api/reviews/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const review = req.body;

    const result = await reviewsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          doctorId: review.doctorId,
          doctorName: review.doctorName,
          doctorImage: review.doctorImage,
          specialization: review.specialization,
          rating: review.rating,
          comment: review.comment,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount > 0) {
      return res.send({
        success: true,
        message: "Review updated successfully",
      });
    }

    res.send({
      success: false,
      message: "Review not updated",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.delete("/api/reviews/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await reviewsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount > 0) {
      return res.send({
        success: true,
        message: "Review deleted successfully",
      });
    }

    res.send({
      success: false,
      message: "Review not found",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/home-stats", async (req, res) => {
  try {
    const totalDoctors = await doctorCollection.countDocuments({
      status: "Verified",
    });

    const totalPatients = await userCollection.countDocuments({
      role: "patient",
    });

    const totalAppointments = await paymentCollection.countDocuments();

    const reviews = await reviewsCollection.find().toArray();

    const averageRating =
      reviews.length > 0
        ? (
            reviews.reduce(
              (sum, review) => sum + Number(review.rating),
              0
            ) / reviews.length
          ).toFixed(1)
        : 0;

    res.send({
      success: true,
      data: {
        totalDoctors,
        totalPatients,
        totalAppointments,
        averageRating,
      },
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/all/reviews",verifyToken, async (req, res) => {
  try {
    const reviews = await reviewsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    console.log("All Reviews:", reviews);

    res.send({
      success: true,
      data: reviews,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});
app.get("/api/home/reviews", async (req, res) => {
  try {
    const reviews = await reviewsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    console.log("All Reviews:", reviews);

    res.send({
      success: true,
      data: reviews,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});
app.post("/api/prescriptions",verifyToken, async (req, res) => {
  try {
    const prescription = req.body;

    const result = await prescriptionCollection.insertOne(prescription);

    res.send({
      success: true,
      insertedId: result.insertedId,
      message: "Prescription created successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/prescriptions",verifyToken, async (req, res) => {
  try {
    const { doctorId, patientId } = req.query;

    const query = {};

    if (doctorId) {
      query.doctorId = doctorId;
    }

    if (patientId) {
      query.patientId = patientId;
    }

    const prescriptions = await prescriptionCollection
      .find(query)
      .sort({ _id: -1 })
      .toArray();

    res.send({
      success: true,
      data: prescriptions,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch prescriptions",
    });
  }
});

app.patch("/api/prescriptions/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      patientName,
      diagnosis,
      symptoms,
      medicine1,
      dosage1,
      frequency1,
      duration1,
      medicine2,
      dosage2,
      frequency2,
      duration2,
      advice,
      followUp,
    } = req.body;

    const result = await prescriptionCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          patientName,
          diagnosis,
          symptoms,
          medicine1,
          dosage1,
          frequency1,
          duration1,
          medicine2,
          dosage2,
          frequency2,
          duration2,
          advice,
          followUp,
        },
      }
    );

    res.send({
      success: true,
      message: "Prescription updated successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      success: false,
      message: "Failed to update prescription",
    });
  }
});

app.delete("/api/prescriptions/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prescriptionCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Prescription not found",
      });
    }

    res.send({
      success: true,
      message: "Prescription deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      success: false,
      message: "Failed to delete prescription",
    });
  }
});

app.get("/api/all/payments",verifyToken, async (req, res) => {
  try {
    const payments = await paymentCollection.find({}).toArray();

    res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
});

app.patch("/api/doctors/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Pending", "Verified", "Suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const result = await doctorCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Doctor ${status} successfully`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update doctor status",
      error: error.message,
    });
  }
});

app.patch("/api/doctors/:id/verify",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Pending", "Verified"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const result = await doctorCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Doctor ${status} successfully`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update verification status",
      error: error.message,
    });
  }
});
app.patch("/api/doctors/:id/suspend",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Verified", "Suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const result = await doctorCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Doctor ${status} successfully`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update suspension status",
      error: error.message,
    });
  }
});

app.get("/api/all/reviews",verifyToken, async (req, res) => {
  try {
    const reviews = await reviewCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: error.message,
    });
  }
});
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "All required fields are mandatory.",
      });
    }

    const contact = {
      name,
      email,
      subject,
      message,
      createdAt: new Date(),
    };

    const result = await contactCollection.insertOne(contact);

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send message.",
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