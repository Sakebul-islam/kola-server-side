require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;

// parsers
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// DB URI
const uri = `mongodb+srv://${process.env.USER_ID_DB}:${process.env.USER_KEY_DB}@cluster0.ltwp59m.mongodb.net/cleanCoDB?retryWrites=true&w=majority`;

// MongoDB Client Connection
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Verify User MiddleWare

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const foodCollection = client.db('kolaDB').collection('foods');
    const requestCollection = client.db('kolaDB').collection('request');

    app.get('/api/v1/foods', async (req, res) => {
      const { quantity, sortField, sortOrder, foodName, userEmail } = req.query;

      const quantityLimit = quantity ? parseInt(quantity, 10) : null;

      let queryObj = {};
      let sortObj = {};

      if (foodName) {
        queryObj.foodName = { $regex: new RegExp(foodName, 'i') };
      }

      if (userEmail) {
        queryObj.donatorEmail = userEmail;
      }

      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const skip = (page - 1) * limit;

      // sorting
      if (sortField && sortField === 'expiredDateTime' && sortOrder) {
        sortObj[sortField] = sortOrder === 'desc' ? -1 : 1;
      } else {
        sortObj.foodQuantity = -1;
      }

      const cursor = foodCollection
        .find(queryObj)
        .skip(skip)
        .limit(limit)
        .sort(sortObj);

      // Convert the cursor to an array
      const result = await cursor.toArray();

      if (quantityLimit !== null) {
        const limitedResult = result.slice(0, quantityLimit);
        res.send(limitedResult);
      } else {
        res.send(result);
      }
    });

    app.get('/api/v1/foods/:id', async (req, res) => {
      const id = req.params.id;
      let query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });

    app.put('/api/v1/foods/:id', async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const query = { _id: new ObjectId(id) };

      const result = await foodCollection.updateOne(query, {
        $set: updateData,
      });
      res.send(result);
      console.log(id);
    });

    app.delete('/api/v1/foods/:id', async (req, res) => {
      const id = req.params.id;
      const result = await foodCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post('/api/v1/foods', async (req, res) => {
      const foodData = req.body;

      const result = await foodCollection.insertOne(foodData);
      res.send(result);
    });

    app.get('/api/v1/user/request', async (req, res) => {
      try {
        const { userEmail, foodId } = req.query;
        let queryObj = {};

        if (userEmail) {
          queryObj.requestPersonEmail = userEmail;
        }

        if (foodId) {
          queryObj.foodId = foodId;
        }

        const result = await requestCollection.find(queryObj).toArray();

        console.log(queryObj);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.post('/api/v1/user/request', async (req, res) => {
      const requestData = req.body;
      const result = await requestCollection.insertOne(requestData);
      console.log(result);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', async (req, res) => {
  res.send('Kola Food Sharing server is : 🆗');
});

app.listen(port, () => {
  console.log(`Kola Food Sharing server is listen on port : ${port}`);
});
