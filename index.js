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

    // foods API
    app.get('/api/v1/foods', async (req, res) => {
      const { quantity, sortField, sortOrder, foodName } = req.query;

      // Parse quantity as a number; if not provided, set it to null
      const quantityLimit = quantity ? parseInt(quantity, 10) : null;

      let queryObj = {};
      let sortObj = {};

      // Add a query for foodName if provided
      if (foodName) {
        queryObj.foodName = { $regex: new RegExp(foodName, 'i') };
      }

      // pagination
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const skip = (page - 1) * limit;

      // sorting
      if (sortField && sortField === 'expiredDateTime' && sortOrder) {
        sortObj[sortField] = sortOrder === 'desc' ? -1 : 1;
      }

      const cursor = foodCollection
        .find(queryObj)
        .skip(skip)
        .limit(limit)
        .sort(sortObj);

      // Convert the cursor to an array
      const result = await cursor.toArray();

      if (quantityLimit !== null) {
        // If a quantity limit is specified, return only the requested number of items
        const limitedResult = result.slice(0, quantityLimit);
        res.send(limitedResult);
      } else {
        // If no quantity limit is specified, return all items
        res.send(result);
      }
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
