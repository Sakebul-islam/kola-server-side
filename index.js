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
    origin: ['http://localhost:5173', 'https://kola-sakib.netlify.app'],
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

// Own verifyToken MiddleWares
const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send('Unauthorized Access ⚠');
  } else {
    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
      if (err) {
        return res.status(401).send('Unauthorized Access ⚠');
      } else {
        req.user = decoded;
        next();
      }
    });
  }
};

const dbConnect = async () => {
  try {
    client.connect();
    console.log(' Database Connected Successfully✅ ');
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

const foodCollection = client.db('kolaDB').collection('foods');
const requestCollection = client.db('kolaDB').collection('request');

app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
    expiresIn: '1h',
  });

  res
    .cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    })
    .send({ success: true });
});
app.post('/logout', async (req, res) => {
  const user = req.body;
  res
    .clearCookie(
      'token',
      { maxAge: 0 },
      {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }
    )
    .send({ success: true });
});

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

app.put('/api/v1/foods/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const updateData = req.body;
  const query = { _id: new ObjectId(id) };

  try {
    // Find the food item and check if req.user.email === donatorEmail
    const food = await foodCollection.findOne(query);

    if (!food) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    const donatorEmail = food.donatorEmail;

    if (req.user.email !== donatorEmail) {
      // Send unauthorized status if the authenticated user is not the donator
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Update the food item with the new data
    const result = await foodCollection.updateOne(query, {
      $set: updateData,
    });

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    res.json({ message: 'Food item updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
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
//   try {
//     if (req.user.email !== req.query.userEmail) {
//       return res.status(403).send({ message: 'forbidden access' });
//     }

//     const { userEmail, foodId } = req.query;
//     let queryObj = {};

//     if (userEmail) {
//       queryObj.requestPersonEmail = userEmail;
//     }

//     if (foodId) {
//       queryObj.foodId = foodId;
//     }

//     const result = await requestCollection.find(queryObj).toArray();

//     res.send(result);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error');
//   }
// });

app.get('/api/v1/user/request', verifyToken, async (req, res) => {
  const { userEmail, foodId } = req.query;

  try {
    if (userEmail && !foodId) {
      if (userEmail !== req.user.email) {
        // Handle unauthorized access
        return res.status(403).send({ message: 'Unauthorized access' });
      } else {
        const result = await requestCollection
          .find({ requestPersonEmail: userEmail })
          .toArray();
        // Send response with userEmail
        return res.send(result);
      }
    }

    if (userEmail && foodId) {
      const food = await requestCollection.findOne({ foodId: foodId });
      const donatorEmail = food ? food.donatorEmail : null;

      if (donatorEmail === req.user.email) {
        const result = await requestCollection.find({ foodId }).toArray();
        return res.send(result);
      } else if (food === null && donatorEmail === null) {
        const result = await requestCollection.find({ foodId }).toArray();
        return res.send(result);
      } else {
        // Handle unauthorized access
        return res.status(403).send({ message: 'Unauthorized access' });
      }
    }

    // Handle other cases or provide a default response
    return res.status(400).send({ message: 'Bad Request' });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
});

app.post('/api/v1/user/request', verifyToken, async (req, res) => {
  const requestData = req.body;

  // Check if requestPersonEmail matches the authenticated user's email
  if (requestData.requestPersonEmail !== req.user.email) {
    return res.status(403).send({ message: 'Unauthorized access' });
  }

  try {
    const result = await requestCollection.insertOne(requestData);
    if (result.acknowledged === true) {
      // Successful insertion
      res.status(201).send({
        message: 'Request created successfully',
      });
    } else {
      // Insertion failed
      res.status(500).send({ message: 'Failed to create request' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.patch('/api/v1/user/request/:id', verifyToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { foodStatus } = req.body;

    if (!foodStatus) {
      return res
        .status(400)
        .json({ error: 'foodStatus is required in the request body' });
    }

    // Find the request and check if req.user.email === donatorEmail
    const request = await requestCollection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const donatorEmail = request.donatorEmail;

    if (req.user.email !== donatorEmail) {
      // Throw an authorization error if the authenticated user is not the donator
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Update the document with the new foodStatus
    const result = await requestCollection.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { foodStatus: foodStatus } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Request updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.delete('/api/v1/user/request/:id', verifyToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    // Find the request to check the requestPersonEmail
    const request = await requestCollection.findOne({
      _id: new ObjectId(requestId),
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if the authenticated user has permission to delete the request
    if (request.requestPersonEmail !== req.user.email) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Delete the document with the given ID
    const result = await requestCollection.deleteOne({
      _id: new ObjectId(requestId),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

//     // Send a ping to confirm a successful connection
//     await client.db('admin').command({ ping: 1 });
//     console.log(
//       'Pinged your deployment. You successfully connected to MongoDB!'
//     );
//   } finally {
//     // Ensures that the client will close when you finish/error
//     // await client.close();
//   }
// }
// run().catch(console.dir);

app.get('/', async (req, res) => {
  res.send('Kola Food Sharing server is : 🆗');
});

app.listen(port, () => {
  console.log(`Kola Food Sharing server is listen on port : ${port}`);
});
